# Frontend Mastery — program material

Thirteen modules that take a working frontend developer to an offer. This repository holds
the **material**: the module decks, the program page and the shared assets. The code you
write lives in a second repository, and the two are used side by side.

| Repository | What it is |
|---|---|
| **this one** | Decks and pages — one folder per module. Read-only for students. |
| [`frontend-mastery-jobboard`](https://github.com/Catalystsw/frontend-mastery-jobboard) | **Rasmi**, the job board you build across the whole program. Every exercise is a branch here. |

---

## Quick start

```sh
# 1 · the material
git clone https://github.com/Catalystsw/frontend-mastery-program.git

# 2 · the exercise repo, cloned next to it
git clone https://github.com/Catalystsw/frontend-mastery-jobboard.git
cd frontend-mastery-jobboard && pnpm install
```

Open a deck by opening the `.html` file in a browser — no build, no server, no dependencies.
If your browser blocks local files, serve the folder instead:

```sh
python3 -m http.server 8000    # then open http://localhost:8000/modules/01-foundations/deck.html
```

### Reading a deck

| Key | What it does |
|---|---|
| `→` `←` | next / previous slide — and inside an animated figure, one step at a time |
| `M` | slide menu |
| `F` | fullscreen |
| `P` | print — flattens every animation step so the PDF shows the finished figure |

These decks carry no speaker notes. What is on the slide is the whole file — nothing is
hidden behind a key or waiting in view-source.

---

## What is in here

```
program/
  program-page.html       the program at a glance
curriculum/
  curriculum-page.html    every lesson, in order — 13 modules, 75 lessons
modules/
  01-foundations/
    deck.html             what companies actually test — 26 slides
    diagnostic-deck.html  the diagnostic, answered and animated — 35 slides
  02-browser-runtime/
    deck.html             the browser as a runtime — 23 slides
  03-javascript-deeply/
    deck.html             the language under the framework — 41 slides, one video per lesson
  04-typescript-frontend/
    deck.html             types that make the wrong state impossible — 20 slides
  05-react-deeply/
    deck.html             the render model, re-renders, hooks and Suspense — 25 slides
  06-react-typescript/
    deck.html             typed props, generic components, typed state and the API layer — 18 slides
  07-ui-engineering/
    deck.html             components and accessibility, built live — 27 slides
  08-data-state-routing/
    deck.html             whose state is it — the server's or yours — 22 slides
  09-nextjs-rendering/
    deck.html             a rendering strategy per route — 22 slides
  10-performance-testing-security/
    deck.html             prove the before and after with numbers — 23 slides
  11-frontend-system-design/
    deck.html             a 45-minute design round, with a script — 21 slides
  12-capstone/
    deck.html             assembly week, not build week — 18 slides
  13-interview-preparation/
    deck.html             every format, drilled under time — 20 slides
repo/
  jobboard-deck.html      the exercise repo, explained end to end
assets/                   screenshots and recordings, shared by every deck
```

Everything a module needs lives in its own folder, so module 9 can be built without opening
module 2. Decks reference `assets/` by relative path — keep the tree intact rather than
copying a single deck somewhere else.

### The modules

Thirteen modules, 75 lessons, 13 build checkpoints. `curriculum/curriculum-page.html` lists
every lesson; this is the shape of it.

| # | Module | # | Module |
|---:|---|---:|---|
| 01 | Foundations — what companies actually test | 08 | Data, state & routing |
| 02 | The browser as a runtime | 09 | Next.js & rendering architecture |
| 03 | JavaScript, deeply | 10 | Performance, testing & security |
| 04 | TypeScript for frontend engineers | 11 | Frontend system design |
| 05 | React, deeply | 12 | The capstone |
| 06 | React + TypeScript in production | 13 | Interview preparation |
| 07 | UI engineering — components & accessibility | | |

---

## How the program is worked

**Module 1, lesson 5** is a twelve-question diagnostic. Every question you miss names the
module that fixes it, so your score is a route through the program, not a grade.

**Module 1, lesson 7** is the first exercise. From then on every module ships a slice of the
job board, and the slices are the same product: the `debounce` written in module 3 is still
running inside the autocomplete in module 7, and both are still in the app deployed in
module 12.

### The exercise loop

Exercises live in the job board repo. Every stage exists **three times**, with byte-identical
tests — only the amount of implementation changes.

| Branch | What is in it |
|---|---|
| `<stage>/start` | Scaffold, types, fixtures and the **failing tests**. No hints. Start here. |
| `<stage>/guided` | The same tests plus numbered `TODO` steps and the reasoning. An escape hatch, not an answer key. |
| `<stage>/solution` | Green, plus `NOTES.md` on the trade-offs and what an interviewer pushes on. |

```sh
git checkout module-1/setup/start
pnpm test:watch                              # red — that red is the deliverable

# ...implement until green...

git diff module-1/setup/solution -- src/     # compare your approach to mine
```

Stuck on one function? Pull the hints for that file only, never the answer:

```sh
git checkout module-1/setup/guided -- src/diagnostic/score.ts
```

**Twenty minutes stuck is the lesson; the hint is the reward.** The compare step at the end
is where most of the learning happens — not in reaching green.

Stages published so far: `module-1/setup/*` (tag `m1-v7-end`), `module-3/utils/*`,
`module-7/autocomplete/*`. The rest arrive as their modules are recorded.

---

## Git conventions

These are the conventions used by every repository in the program, and they are the same
ones a reviewer on a real team expects. They exist so you can pause a video, run one command,
and be looking at exactly what is on screen.

### 1 · One branch per video

```
module-<N>/v<V>-<slug>          e.g. module-4/v2-identity-service
```

Module number first so the branch list sorts into program order; video number second so it
sorts into recording order. The slug names what the video *builds*, not what it is about.

In this material repository, `main` carries every module. A module-named branch
(`module-<N>/<slug>`) is created only when a module genuinely needs one — a reworked deck, an
alternative recording — and most modules never will.

### 2 · A tag on each video's end state

```
m<N>-v<V>-end                   e.g. m4-v2-end
```

Fell behind? `git checkout m4-v2-end` and you are caught up. Tags are immutable and short on
purpose — they get typed by hand, from a video, by someone already frustrated.

### 3 · Exercise stages carry three branches

The three variants nest **under** the stage name — `module-3/utils/start`, `/guided`,
`/solution` — which means a bare `module-3/utils` branch can never exist; git cannot store a
ref as both a file and a directory. The video's end state is the `solution` branch plus its
tag.

### 4 · Commits

Conventional commits, one per milestone — the points where the video says "and now we…",
not every save:

```
feat(search): debounce the query at 300ms
fix(autocomplete): ignore responses that arrive out of order
test(utils): cover the trailing-edge call
```

The type is your changelog, and your commit history is what an interviewer actually reads
when you hand over the capstone.

### 5 · Secrets never land

`.env.example` is committed with dummy values; `.env` is not. A pre-commit hook stops you. If
a real key ever lands in history, rotate it — deleting the commit is not enough.

---

## Questions and corrections

Open an issue on this repository for anything in the material — a slide that is wrong, a
figure that does not render, a lesson that needs a step spelled out. For the code, open it on
the [job board repo](https://github.com/Catalystsw/frontend-mastery-jobboard) instead,
and say which stage branch you are on.
