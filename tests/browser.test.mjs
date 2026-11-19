// Every page opens in headless Chrome, and every deck plays from the first slide to the
// last (one → press at a time, through every step of every figure) without an uncaught
// error. Chrome is driven over the DevTools protocol with Node's own WebSocket, so the repo
// keeps no dependencies.
//
// Chrome comes from CHROME_PATH (the Jenkins agent sets it), else the usual install paths
// or Playwright's cache. Without one the test skips locally and fails under CI=true.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { root, tracked } from '../scripts/html.mjs';

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim();
    } catch {}
  }
  const fixed = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  const found = fixed.find((p) => existsSync(p));
  if (found) return found;
  for (const cache of [path.join(homedir(), 'Library/Caches/ms-playwright'), path.join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(cache)) continue;
    for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-linux64/chrome',
        'chrome-linux/chrome',
      ]) {
        const p = path.join(cache, dir, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };

// The repo root over HTTP, like `python3 -m http.server` in the README.
function serve() {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, path.normalize(rel));
    if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// A minimal DevTools protocol client over one browser connection, with flat sessions.
class DevTools {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    this.ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const fn of this.listeners) fn(msg);
      }
    });
    this.open = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
  waitFor(method, sessionId, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(fn);
        reject(new Error(`no ${method} within ${ms} ms`));
      }, ms);
      const fn = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) {
          clearTimeout(timer);
          this.listeners.delete(fn);
          resolve(msg.params);
        }
      };
      this.listeners.add(fn);
    });
  }
}

const chromePath = findChrome();
// PAGES=07,jobboard runs only the pages whose path contains one of those strings.
const only = process.env.PAGES?.split(',').filter(Boolean);
const pages = tracked('*.html').filter((f) => !only || only.some((s) => f.includes(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server, chrome, devtools, profile, base;

before(async () => {
  if (!chromePath) return;
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  profile = mkdtempSync(path.join(tmpdir(), 'fmp-chrome-'));
  chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--mute-audio', '--hide-scrollbars',
    '--window-size=1600,900',
    // Containers (the Jenkins agent) give Chrome no user namespace for its sandbox.
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const url = await new Promise((resolve, reject) => {
    let err = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not start:\n${err}`)), 120_000);
    chrome.stderr.on('data', (chunk) => {
      err += chunk;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited (${code}):\n${err}`)));
  });
  devtools = new DevTools(url);
  await devtools.open;
  // Warm up: the first renderer is the slow one, and it should not count against a page.
  const { targetId } = await devtools.send('Target.createTarget', { url: 'about:blank' });
  await devtools.send('Target.closeTarget', { targetId });
});

after(async () => {
  try {
    if (devtools) await Promise.race([devtools.send('Browser.close').catch(() => {}), sleep(5000)]);
  } finally {
    chrome?.kill();
    server?.close();
    if (profile) rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
});

async function play(file) {
  const { targetId } = await devtools.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await devtools.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => devtools.send(method, params, sessionId);
  const errors = [];
  const onError = (msg) => {
    if (msg.sessionId !== sessionId || msg.method !== 'Runtime.exceptionThrown') return;
    const d = msg.params.exceptionDetails;
    const where = d.url ? ` (${d.url.replace(base, '')}:${d.lineNumber + 1})` : '';
    errors.push(`${d.exception?.description?.split('\n')[0] ?? d.text}${where}`);
  };
  devtools.listeners.add(onError);
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    // A busy machine can take a minute to load a page; a second try tells a slow box from a
    // page that never loads.
    for (let attempt = 1; ; attempt++) {
      const loaded = devtools.waitFor('Page.loadEventFired', sessionId, 120_000);
      loaded.catch(() => {});
      await send('Page.navigate', { url: base + file });
      try {
        await loaded;
        break;
      } catch (e) {
        if (attempt === 2) throw new Error(`${file}: ${e.message}, twice`);
        errors.length = 0;
      }
    }
    await sleep(500);

    // [slides, current slide, steps shown on it]
    const state = () => evaluate(`(() => {
      const s = [...document.querySelectorAll('.slide')];
      const i = s.findIndex((x) => x.classList.contains('on'));
      return [s.length, i, i < 0 ? 0 : s[i].querySelectorAll('.frag.on').length];
    })()`);
    let [slides, current] = await state();
    if (slides > 0) {
      assert.equal(current, 0, `${file}: the first slide is showing after load`);
      let presses = 0;
      let onSlide = 0;
      while (current < slides - 1) {
        await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }))`);
        await sleep(60);
        const [, next] = await state();
        presses++;
        onSlide = next === current ? onSlide + 1 : 0;
        if (next !== current) await sleep(150); // let the slide's figures and demos start
        assert.ok(onSlide < 120, `${file}: → stopped advancing on slide ${current + 1} of ${slides}`);
        assert.ok(next >= current, `${file}: → went back from slide ${current + 1} to ${next + 1}`);
        current = next;
      }
      // The last slide's own steps, then time for late timers and animations to throw.
      for (let k = 0; k < 30; k++) {
        await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }))`);
        await sleep(40);
      }
      assert.ok(presses >= slides - 1, `${file}: reached the last slide`);
    }
    await sleep(1500);
    assert.deepEqual(errors, [], `${file}: uncaught errors`);
  } finally {
    devtools.listeners.delete(onError);
    await devtools.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

test('every page opens and every deck plays to its last slide without an uncaught error', { concurrency: 2 }, async (t) => {
  if (!chromePath) {
    assert.ok(!process.env.CI, 'CI needs Chrome: set CHROME_PATH');
    t.skip('no Chrome found (set CHROME_PATH)');
    return;
  }
  await Promise.all(pages.map((file) => t.test(file, { timeout: 600_000 }, () => play(file))));
});
