// The numbers the README and the pages state about the decks match the decks themselves:
// which files exist, how many slides each has, how many modules and lessons there are, and
// which module each slide's chip names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tracked, read, tags, slideCount, markup } from '../scripts/html.mjs';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const number = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS.indexOf(s.toLowerCase()));
const text = (html) => markup(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const claims = (s, noun) =>
  [...s.matchAll(new RegExp(`\\b(\\d+|${WORDS.join('|')})\\s+${noun}\\b`, 'gi'))].map((m) => number(m[1]));

const readme = read('README.md');
const html = tracked('*.html');
const modules = [...new Set(tracked('modules/').map((f) => f.split('/')[1]))];

// The file tree under "## What is in here": two spaces per level, folders end in "/".
function readmeTree() {
  const section = readme.split(/^## What is in here$/m)[1];
  assert.ok(section, 'README has a "## What is in here" section');
  const block = section.match(/```\n([\s\S]*?)```/)[1];
  const entries = [];
  const stack = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^( *)(\S+)(?:\s+(.*))?$/);
    if (!m) continue;
    const depth = m[1].length / 2;
    stack.length = depth;
    if (m[2].endsWith('/')) {
      stack.push(m[2].slice(0, -1));
      continue;
    }
    const slides = (m[3] ?? '').match(/(\d+) slides/);
    entries.push({ file: [...stack, m[2]].join('/'), slides: slides && Number(slides[1]) });
  }
  return entries;
}

test('the README file tree lists every HTML file, and only files that exist', () => {
  const listed = readmeTree().map((e) => e.file).sort();
  assert.deepEqual(listed, html);
});

test('the README slide counts match the decks', () => {
  for (const { file, slides } of readmeTree()) {
    if (slides === null) continue;
    assert.equal(slideCount(read(file)), slides, `${file}: README says ${slides} slides`);
  }
});

test('module folders are numbered 01, 02, … with no gaps, each with a deck.html', () => {
  modules.forEach((dir, i) => {
    assert.match(dir, /^\d\d-[a-z0-9-]+$/, `${dir} is named NN-slug`);
    assert.equal(Number(dir.slice(0, 2)), i + 1, `${dir} follows ${modules[i - 1] ?? 'nothing'}`);
    assert.ok(html.includes(`modules/${dir}/deck.html`), `${dir} has a deck.html`);
  });
});

test('every "N modules" in the README and the pages matches the module folders', () => {
  const sources = { 'README.md': readme, ...Object.fromEntries(['program/program-page.html', 'curriculum/curriculum-page.html'].map((f) => [f, text(read(f))])) };
  for (const [file, s] of Object.entries(sources)) {
    for (const n of claims(s, 'modules')) assert.equal(n, modules.length, `${file} says ${n} modules`);
  }
  const table = readme.split(/^### The modules$/m)[1].split(/^---$/m)[0];
  const numbers = [...table.matchAll(/\|\s*(\d\d)\s*\|/g)].map((m) => m[1]).sort();
  assert.deepEqual(numbers, modules.map((d) => d.slice(0, 2)), 'README module table');
});

test('the curriculum page lists one block per module, and its lesson counts add up', () => {
  const page = read('curriculum/curriculum-page.html');
  const blocks = [...page.matchAll(/<details class="mod">([\s\S]*?)<\/details>/g)].map((m) => m[1]);
  assert.deepEqual(blocks.map((b) => b.match(/class="mnum">(\d+)</)[1]), modules.map((d) => d.slice(0, 2)));
  let total = 0;
  for (const b of blocks) {
    const stated = Number(b.match(/class="count">(\d+) lessons?</)[1]);
    const items = (b.match(/<li\b/g) ?? []).length;
    assert.equal(items, stated, `module ${b.match(/class="mnum">(\d+)</)[1]} says ${stated} lessons, lists ${items}`);
    total += items;
  }
  const outside = text(page.replace(/<details class="mod">[\s\S]*?<\/details>/g, ''));
  const sources = { 'README.md': readme, 'program/program-page.html': text(read('program/program-page.html')), 'curriculum/curriculum-page.html': outside };
  for (const [file, s] of Object.entries(sources)) {
    for (const n of claims(s, 'lessons')) assert.equal(n, total, `${file} says ${n} lessons; the curriculum lists ${total}`);
  }
});

test('every slide chip names the module its deck is in', () => {
  for (const file of html.filter((f) => f.startsWith('modules/'))) {
    const nn = file.split('/')[1].slice(0, 2);
    for (const { attrs, line } of tags(read(file))) {
      const m = (attrs['data-chip'] ?? '').match(/MODULE\s+(\d+)/i);
      if (m) assert.equal(m[1].padStart(2, '0'), nn, `${file}:${line}: chip "${attrs['data-chip']}"`);
    }
  }
});
