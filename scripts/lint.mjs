// Lint every tracked HTML file:
//   - each inline <script> parses: classic scripts and modules as JavaScript, import maps
//     and JSON blocks as JSON (other types, such as text/plain, are text the page reads);
//   - each local reference (href, src, poster, CSS url()) points at a tracked file, by a
//     relative path that stays inside the repo, because students open the decks from disk;
//   - no reference points at a dev-only host (localhost, *.localhost, 127.0.0.1).
// Usage: node scripts/lint.mjs   (exit 1 on any problem)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { tracked, read, scripts, tags, markup, lineAt } from './html.mjs';

const problems = [];
const report = (file, line, message) => problems.push(`${file}:${line}: ${message}`);

const files = new Set(tracked());
const htmlFiles = tracked('*.html');
const tmp = mkdtempSync(path.join(tmpdir(), 'fmp-lint-'));

const CLASSIC = new Set(['', 'text/javascript', 'application/javascript']);
const JSON_TYPES = new Set(['importmap', 'application/json', 'application/ld+json', 'speculationrules']);

function checkScript(file, { attrs, body, line }) {
  if (attrs.src !== undefined || !body.trim()) return;
  const type = (attrs.type ?? '').trim().toLowerCase();
  if (CLASSIC.has(type)) {
    try {
      new vm.Script(body, { filename: file, lineOffset: line - 1 });
    } catch (e) {
      report(file, line, `script does not parse: ${e.message}`);
    }
  } else if (type === 'module') {
    // vm.SourceTextModule needs a flag, so modules go through `node --check`. The padding
    // keeps the reported line equal to the line in the deck.
    const out = path.join(tmp, `m${line}.mjs`);
    writeFileSync(out, '\n'.repeat(line - 1) + body);
    try {
      execFileSync(process.execPath, ['--check', out], { stdio: 'pipe' });
    } catch (e) {
      const msg = e.stderr.toString().split('\n').find((l) => /Error/.test(l)) ?? 'syntax error';
      const at = e.stderr.toString().match(/\.mjs:(\d+)/);
      report(file, at ? Number(at[1]) : line, `module script does not parse: ${msg.trim()}`);
    }
  } else if (JSON_TYPES.has(type)) {
    try {
      JSON.parse(body);
    } catch (e) {
      report(file, line, `${type} is not valid JSON: ${e.message}`);
    }
  }
}

const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/i;

function checkRef(file, line, ref) {
  const value = ref.trim();
  if (!value || value.startsWith('#') || /^(data|mailto|tel|javascript|blob|about):/i.test(value)) return;
  if (/^(https?:)?\/\//i.test(value)) {
    let host;
    try {
      host = new URL(value, 'https://x.invalid').hostname;
    } catch {
      return report(file, line, `not a valid URL: ${value}`);
    }
    if (DEV_HOST.test(host)) report(file, line, `points at a dev-only host: ${value}`);
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return report(file, line, `unexpected scheme: ${value}`);
  if (value.startsWith('/')) return report(file, line, `root-absolute path breaks when a deck is opened from disk: ${value}`);
  let rel;
  try {
    rel = decodeURIComponent(value.replace(/[?#].*$/, ''));
  } catch {
    return report(file, line, `badly encoded path: ${value}`);
  }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), rel));
  if (target.startsWith('../') || target === '..') return report(file, line, `points outside the repository: ${value}`);
  const candidate = target.endsWith('/') || target === '.' ? path.posix.join(target, 'index.html') : target;
  if (!files.has(candidate)) report(file, line, `points at a file that is not in the repository: ${value}`);
}

const URL_ATTRS = ['href', 'src', 'poster'];

for (const file of htmlFiles) {
  const html = read(file);
  for (const s of scripts(html)) checkScript(file, s);
  for (const { attrs, line } of tags(html)) {
    for (const name of URL_ATTRS) if (attrs[name] !== undefined) checkRef(file, line, attrs[name]);
    if (attrs.style) for (const m of attrs.style.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) checkRef(file, line, m[2]);
  }
  // CSS url() inside <style> blocks. markup() blanks their bodies, so read them from the source.
  const kept = markup(html);
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    if (kept.slice(m.index, m.index + 6).toLowerCase() !== '<style') continue; // inside a comment or script
    const start = m.index + m[0].indexOf('>') + 1;
    for (const u of m[1].matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      checkRef(file, lineAt(html, start + u.index), u[2]);
    }
  }
}

rmSync(tmp, { recursive: true, force: true });

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nlint: ${problems.length} problem(s) in ${htmlFiles.length} HTML files`);
  process.exit(1);
}
console.log(`lint: ${htmlFiles.length} HTML files clean (scripts parse, local references resolve)`);
