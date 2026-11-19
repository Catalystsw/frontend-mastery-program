// Shared by scripts/lint.mjs and tests/: the tracked files, and a small HTML scanner.
// The decks are hand-written single files, so a few regular expressions that respect
// quoted attribute values are enough; nothing here tries to be a full HTML parser.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function tracked(...patterns) {
  const out = execFileSync('git', ['ls-files', '-z', '--', ...patterns], { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter(Boolean).sort();
}

export const read = (file) => readFileSync(path.join(root, file), 'utf8');

export const lineAt = (text, index) => lines(text)(index);

// lines(text) returns index -> 1-based line number, by binary search over newline offsets.
const lineIndexes = new Map();
function lines(text) {
  let find = lineIndexes.get(text);
  if (find) return find;
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  find = (index) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
  if (lineIndexes.size > 32) lineIndexes.clear();
  lineIndexes.set(text, find);
  return find;
}

// Every <script> element with its attributes, body and the line its body starts on.
// HTML ends a script at the first `</script`, which is why the decks write `<\/script>`
// inside strings.
export function scripts(html) {
  const found = [];
  for (const m of html.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = attributes(m[1]);
    const bodyStart = m.index + m[0].indexOf('>') + 1;
    found.push({ attrs, body: m[2], line: lineAt(html, bodyStart) });
  }
  return found;
}

export function attributes(source) {
  const attrs = {};
  for (const m of source.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

// The markup with comments and the bodies of script, style, textarea and template blanked
// out (newlines kept, so line numbers still match the file). What is left is real elements.
export function markup(html) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style|textarea|template)\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)(<\/\2\s*>)/gi,
      (_, open, _tag, body, close) => open + blank(body) + close);
}

// Every start tag in the markup: { tag, attrs, line }.
export function tags(html) {
  const text = markup(html);
  const found = [];
  for (const m of text.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/g)) {
    found.push({ tag: m[1].toLowerCase(), attrs: attributes(m[2]), line: lineAt(text, m.index) });
  }
  return found;
}

// The deck engine walks `document.querySelectorAll('.slide')`; this counts the same elements.
export const slideCount = (html) =>
  tags(html).filter((t) => (t.attrs.class ?? '').split(/\s+/).includes('slide')).length;
