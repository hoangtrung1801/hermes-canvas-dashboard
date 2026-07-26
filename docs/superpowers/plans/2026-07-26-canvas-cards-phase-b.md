# Canvas Cards (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five canvas cards read as one family — a shared token layer and chassis instead of five hand-invented palettes — and fix the interiors that look unfinished: corner-jammed Notes, a broken Docs heading scale, clipped Link URLs, and fixed-height cards full of dead space.

**Architecture:** A `.tl-container`-scoped `--hc-*` token layer becomes the single source of colour, spacing and type scale; `.hermes-shape` is rebuilt on it as the one chassis every card shares, and each card keeps only its accent and body layout. Note is promoted from a native `geo` rectangle to a real `note_card` shape so it can sit on that chassis. Height fitting is a pure function driven by discrete events, never per-keystroke.

**Tech Stack:** React 19, TypeScript, tldraw 5.2.2, `@tldraw/tlschema` migrations, `@tldraw/sync`, Vitest + @testing-library/react + jsdom, plain global CSS. Python agent service (`agent_service/`) for the documentation task only.

## Global Constraints

- tldraw version is 5.2.2. Phase A is already merged — the toolbar, style panel and quick actions are settled; do not revisit them.
- No new dependencies.
- Verify with a command whose exit status is real. Do **not** pipe into `tail`/`grep` inside an `&&` chain — a pipeline returns the last command's status and will hide failures. Use:
  ```bash
  set -e
  npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
  npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
  ```
- Existing tests mock the `tldraw` module wholesale via `vi.mock('tldraw', ...)`. Follow that pattern.
- Card colours must route through tokens. After Task 2 no `.hermes-*` rule may contain a hex literal; Task 2 adds the test that enforces this.
- `--hc-accent` means **accent only**. The card background is derived from it, never assigned to it.
- Note promotion changes only the *resulting shape type*. The `create_note_card` action name, its parameters and its zod schema stay as they are, so the agent's calling convention is unchanged.
- Existing `geo` rectangles on the board are **not** migrated and must keep working, including their auto-frame grouping.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/canvas/tldraw/canvasTokens.css` *(new)* | The `--hc-*` vocabulary. No logic, imported once. |
| `src/styles.css` *(modify)* | `.hermes-shape` chassis + per-card rules, rewritten onto tokens. |
| `src/canvas/tldraw/customShapeUtils.tsx` *(modify)* | `cardStyle` sets the accent; Todo gains content-fit height. |
| `src/canvas/tldraw/customShape.types.ts` *(modify)* | `fitTodoBlockHeight` — pure height maths. |
| `src/canvas/tldraw/noteCard.types.ts` *(new)* | `note_card` type string, props, defaults, migrations, props factory. |
| `src/canvas/tldraw/noteCardUtils.tsx` *(new)* | `NoteCardShapeUtil` + its React component. |
| `src/canvas/tldraw/tldrawSchema.ts` *(modify)* | `note_card` store schema entry. |
| `src/canvas/tldraw/tldrawActionExecutor.ts` *(modify)* | `create_note_card` emits `note_card`. |
| `src/canvas/tldraw/autoFrameLayout.ts` *(modify)* | Dual note mapping: `note_card` **and** legacy `geo` rectangle. |
| `src/canvas/tldraw/nativeNoteCard.ts` + `.test.ts` *(delete)* | Dead once the executor stops using it. |
| `CANVAS_API.md`, `agent_service/canvas_tools.py`, `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md` *(modify)* | The note contract, currently documented as a native geo rectangle. |

---

### Task 1: Canvas token layer and the shared chassis

**Files:**
- Create: `src/canvas/tldraw/canvasTokens.css`
- Modify: `src/main.tsx` (import it)
- Modify: `src/styles.css` — `.hermes-shape` (starts at line 1103) and `.hermes-card-header` / `.hermes-card-icon` / `.hermes-progress-badge`
- Test: `src/canvas/tldraw/canvasTokens.test.ts` (create)

**Interfaces:**
- Produces: the `--hc-*` custom properties, scoped to `.tl-container`. Every later task consumes them.

- [ ] **Step 1: Write the failing test**

Create `src/canvas/tldraw/canvasTokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = () => readFileSync('src/canvas/tldraw/canvasTokens.css', 'utf8')

describe('canvas token layer', () => {
  it('scopes the tokens to the tldraw container so they cannot collide with the dark dashboard tokens', () => {
    expect(tokens()).toMatch(/^\.tl-container \{/m)
  })

  it('defines the full vocabulary', () => {
    const css = tokens()
    for (const token of [
      '--hc-surface',
      '--hc-ink',
      '--hc-ink-strong',
      '--hc-ink-muted',
      '--hc-line',
      '--hc-accent',
      '--hc-tint',
      '--hc-pad',
      '--hc-gap',
      '--hc-radius',
      '--hc-shadow'
    ]) {
      expect(css).toContain(`${token}:`)
    }
  })

  it('derives the tint from the accent rather than hardcoding it', () => {
    expect(tokens()).toMatch(/--hc-tint:\s*color-mix\([^)]*var\(--hc-accent\)/)
  })

  it('is imported by the app entry point', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/canvasTokens\.css/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- canvasTokens`
Expected: FAIL — `ENOENT`, the stylesheet does not exist.

- [ ] **Step 3: Create the token layer**

Create `src/canvas/tldraw/canvasTokens.css`:

```css
/*
 * The canvas token vocabulary.
 *
 * Scoped to .tl-container on purpose: the :root tokens in styles.css are a dark
 * palette serving the debug dashboard, and the light pastel cards cannot use
 * them. Keeping these separate is what stops the two palettes colliding.
 */
.tl-container {
  --hc-surface: #ffffff;
  --hc-ink: #25252d;
  --hc-ink-strong: #202027;
  --hc-ink-muted: #6b7280;
  --hc-line: rgba(0, 0, 0, 0.1);

  /* Overridden per shape from the tldraw theme colour. Accent only — the
     background is derived from it below, never assigned to it. */
  --hc-accent: #6c5ce7;
  --hc-tint: color-mix(in srgb, var(--hc-accent) 8%, var(--hc-surface));

  --hc-pad: 16px;
  --hc-gap: 10px;
  --hc-radius: 14px;

  --hc-title: 16px;
  --hc-body: 14px;
  --hc-meta: 12px;

  --hc-shadow: 0 2px 8px rgba(42, 39, 65, 0.08), 0 12px 28px rgba(42, 39, 65, 0.05);
  --hc-ring: 0 0 0 3px color-mix(in srgb, var(--hc-accent) 18%, transparent);
}
```

Import it in `src/main.tsx`, immediately after the existing `./styles.css` import:

```tsx
import './styles.css'
import './canvas/tldraw/canvasTokens.css'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- canvasTokens`
Expected: PASS, 4 tests.

- [ ] **Step 5: Rebuild the chassis onto the tokens**

In `src/styles.css`, replace the `.hermes-shape` rule and its focus rule with the chassis. The accent rail is a pseudo-element so no card markup has to change:

```css
.hermes-shape {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--hc-line);
  border-radius: var(--hc-radius);
  background: var(--hc-tint);
  color: var(--hc-ink);
  font: var(--hc-body) / 1.45 var(--hermes-canvas-font);
  padding: var(--hc-pad);
  pointer-events: all;
  overflow-wrap: anywhere;
  box-shadow: var(--hc-shadow);
  transition: box-shadow 0.16s ease, border-color 0.16s ease;
}

/* Accent rail — the one mark that tells the five card kinds apart. */
.hermes-shape::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--hc-accent);
  border-radius: var(--hc-radius) var(--hc-radius) 0 0;
}

.hermes-shape:hover {
  border-color: color-mix(in srgb, var(--hc-accent) 34%, var(--hc-line));
}

.hermes-shape:focus-within {
  border-color: color-mix(in srgb, var(--hc-accent) 62%, transparent);
  box-shadow: var(--hc-ring), var(--hc-shadow);
}
```

Then retoken the three shared header rules — replace their hardcoded colours only, leaving layout untouched:

- `.hermes-card-header strong` → `color: var(--hc-ink-strong);` and `font-size: var(--hc-title);`
- `.hermes-card-icon` → `color: var(--hc-accent);`
- `.hermes-progress-badge` → `border: 1px solid var(--hc-line); background: color-mix(in srgb, var(--hc-surface) 62%, transparent); color: var(--hc-ink-muted); font-size: var(--hc-meta);`
- `.hermes-card-kicker` → `color: var(--hc-ink-muted); font-size: var(--hc-meta);`

- [ ] **Step 6: Verify and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
git add src/canvas/tldraw/canvasTokens.css src/canvas/tldraw/canvasTokens.test.ts src/main.tsx src/styles.css
git commit -m "feat: add canvas token layer and rebuild the card chassis on it"
```

---

### Task 2: Route every card accent through the token

Today `cardStyle` (`customShapeUtils.tsx:139-153`) assigns the resolved theme colour to **both** `backgroundColor` and `--hermes-card-accent`, then `.hermes-link-card` runs `color-mix` against that to derive a border and icon colour — needing `!important` to win. This task makes the accent mean one thing.

**Files:**
- Modify: `src/canvas/tldraw/customShapeUtils.tsx:139-153` (`cardStyle`)
- Modify: `src/canvas/tldraw/projectCardUtils.tsx:39-44` (same inline pattern)
- Modify: `src/styles.css` — `.hermes-todo-block`, `.hermes-task-card`, `.hermes-link-card`, `.hermes-docs-card`
- Test: `src/canvas/tldraw/customShapeUtils.test.tsx:421,450` (update), plus a new guard test

**Interfaces:**
- Consumes: `--hc-accent` / `--hc-tint` from Task 1.
- Produces: `cardStyle` returns `{ width, height, '--hc-accent'?: string }` — no `backgroundColor` key.

**Note on the two existing tests:** `customShapeUtils.test.tsx:421` and `:450` assert an inline `backgroundColor` on `.hermes-shape`. That contract is being replaced, so the assertions move to the custom property. This is not a weakening — jsdom exposes inline custom properties, and the new assertion pins the new contract exactly. Background now comes from CSS, which unit tests do not evaluate.

- [ ] **Step 1: Update the two existing assertions and add the guard**

In `src/canvas/tldraw/customShapeUtils.test.tsx`, change line 421:

```tsx
    expect(screen.getByText('Docs').closest('.hermes-shape')).toHaveStyle({ '--hc-accent': '#fecaca' })
```

and line 450:

```tsx
    expect(screen.getByText('Docs').closest('.hermes-shape')).toHaveStyle({ '--hc-accent': '#fef3c7' })
```

Add a new test file `src/canvas/tldraw/cardTokens.test.ts` — this is the mechanical check that keeps the family together:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('card colour discipline', () => {
  it('routes every .hermes-* colour through a token', () => {
    const css = readFileSync('src/styles.css', 'utf8')

    // Collect each .hermes-* rule body and look for raw hex literals.
    const offenders: string[] = []
    const rulePattern = /^(\.hermes-[^{]*)\{([^}]*)\}/gm

    for (const [, selector, body] of css.matchAll(rulePattern)) {
      if (/#[0-9a-fA-F]{3,8}\b/.test(body)) offenders.push(selector.trim())
    }

    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- customShapeUtils cardTokens`
Expected: FAIL — the two assertions fail because `backgroundColor` is still set and `--hc-accent` is not, and the guard lists every `.hermes-*` rule still holding a hex.

- [ ] **Step 3: Make the accent the only inline colour**

Replace `cardStyle` in `src/canvas/tldraw/customShapeUtils.tsx`:

```tsx
function cardStyle(
  editor: ReturnType<typeof useEditor>,
  props: { w: number; h: number; color?: string; backgroundColor?: string }
): CSSProperties {
  const colors = editor.getCurrentTheme().colors[editor.getColorMode()]
  const accent = props.color
    ? getColorValue(colors, props.color, 'noteFill')
    : props.backgroundColor

  return {
    width: props.w,
    height: props.h,
    ...(accent ? { '--hc-accent': accent } : {})
  } as CSSProperties
}
```

Apply the same change in `src/canvas/tldraw/projectCardUtils.tsx:39-44`: set `'--hc-accent'` where it currently sets `backgroundColor` and `--hermes-card-accent`.

- [ ] **Step 4: Retoken the per-card rules**

In `src/styles.css`, the five card rules keep only what genuinely differs. Delete every hardcoded background and the `!important`:

```css
.hermes-todo-block {
  display: flex;
  flex-direction: column;
}

.hermes-task-card {
  /* background now derives from --hc-accent via the chassis */
}

.hermes-link-card {
  display: flex;
  flex-direction: column;
}

.hermes-docs-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--hc-gap);
}
```

Delete `.hermes-link-card .hermes-card-icon` entirely — the chassis already sets the icon to `var(--hc-accent)`. If `.hermes-task-card` ends up with an empty body, delete the rule.

Then sweep the remaining `.hermes-*` rules the guard test names — `.hermes-link-preview`, `.hermes-link-description`, `.hermes-link-footer`, `.hermes-docs-open-button`, `.hermes-task-*`, `.hermes-project-*`, the modal rules — replacing each hex with the nearest token (`--hc-ink`, `--hc-ink-muted`, `--hc-ink-strong`, `--hc-line`, `--hc-surface`, or a `color-mix` against `--hc-accent`). Re-run the guard after each group; it names the exact selectors still failing.

- [ ] **Step 5: Verify and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
git add -A
git commit -m "refactor: route card colours through the accent token"
```

---

### Task 3: Fix the Docs markdown scale

`asasd` currently renders as an enormous `h1` over near-unreadable body text, because `.hermes-docs-content :where(h1,h2,h3)` (`styles.css:1888-1892`) sets no font sizes and inherits the browser defaults. These cards are read at 44% zoom, so hierarchy must come from weight, not size. No test locks this block, so it is free to redesign.

**Files:**
- Modify: `src/styles.css:1883-1932` (`.hermes-docs-content` and descendants)
- Test: `src/canvas/tldraw/docsMarkdownScale.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/canvas/tldraw/docsMarkdownScale.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function rule(pattern: RegExp) {
  return readFileSync('src/styles.css', 'utf8').match(pattern)?.groups?.body ?? ''
}

describe('docs card markdown scale', () => {
  it('compresses h1 so it cannot dwarf the body text', () => {
    const body = rule(/\.hermes-docs-content h1 \{(?<body>[\s\S]*?)\n\}/)
    expect(body).toMatch(/font-size:\s*calc\(var\(--hc-body\) \* 1\.25\)/)
    expect(body).toMatch(/font-weight:\s*700/)
  })

  it('scales h2 and h3 below h1', () => {
    expect(rule(/\.hermes-docs-content h2 \{(?<body>[\s\S]*?)\n\}/)).toMatch(
      /font-size:\s*calc\(var\(--hc-body\) \* 1\.12\)/
    )
    expect(rule(/\.hermes-docs-content h3 \{(?<body>[\s\S]*?)\n\}/)).toMatch(
      /font-size:\s*var\(--hc-body\)/
    )
  })

  it('styles the heading levels markdown-it can emit but the card never did', () => {
    const css = readFileSync('src/styles.css', 'utf8')
    expect(css).toMatch(/\.hermes-docs-content :where\(h4, h5, h6\)/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- docsMarkdownScale`
Expected: FAIL — no `h1`/`h2`/`h3` rules exist; only the grouped `:where(h1, h2, h3)` rule does.

- [ ] **Step 3: Rewrite the heading scale**

In `src/styles.css`, replace the grouped heading rule at 1888-1892 with an explicit scale:

```css
.hermes-docs-content :where(h1, h2, h3, h4, h5, h6) {
  margin: 0.55em 0 0.3em;
  color: var(--hc-ink-strong);
  line-height: 1.25;
  font-weight: 700;
}

.hermes-docs-content h1 {
  font-size: calc(var(--hc-body) * 1.25);
  font-weight: 700;
}

.hermes-docs-content h2 {
  font-size: calc(var(--hc-body) * 1.12);
}

.hermes-docs-content h3 {
  font-size: var(--hc-body);
}

.hermes-docs-content :where(h4, h5, h6) {
  font-size: var(--hc-meta);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hc-ink-muted);
}
```

- [ ] **Step 4: Verify against real content**

Run `npm run dev`, open a Docs card containing `# Heading` and body text.
Expected: the heading reads as a heading but no longer dominates the card; body text stays legible.

- [ ] **Step 5: Run the suite and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
git add -A
git commit -m "fix: compress the docs card markdown heading scale"
```

---

### Task 4: Link card overflow and preview collapse

Long URLs clip, and the preview slot reserves space even with no image, leaving the URL floating below a void.

**Files:**
- Modify: `src/canvas/tldraw/customShapeUtils.tsx` (LinkCard component — add `title` to the URL span)
- Modify: `src/styles.css` — `.hermes-link-preview`, `.hermes-link-footer`
- Test: `src/canvas/tldraw/customShapeUtils.test.tsx` (add)

- [ ] **Step 1: Write the failing test**

Append to the LinkCard describe block in `src/canvas/tldraw/customShapeUtils.test.tsx`:

```tsx
  it('exposes the full url as a tooltip so a clipped one stays readable', () => {
    const util = new LinkCardShapeUtil({} as any)
    const url = 'https://example.com/a/very/long/path/that/will/not/fit/in/the/card'

    render(
      util.component({
        id: 'shape:link_long',
        type: 'link_card',
        x: 0, y: 0, rotation: 0, index: 'a1', parentId: 'page:page',
        isLocked: false, opacity: 1, meta: {},
        props: { w: 300, h: 120, title: 'Long', url, description: '' }
      } as any)
    )

    expect(screen.getByTitle(url)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- customShapeUtils`
Expected: FAIL — unable to find an element with that title.

- [ ] **Step 3: Add the tooltip and collapse the empty preview**

In the LinkCard component in `customShapeUtils.tsx`, add `title={shape.props.url}` to the `<span>` inside `.hermes-link-footer` that renders the URL text.

In `src/styles.css`, make the preview collapse when absent — the image element is only rendered when `imageUrl` is set, so the fix is to stop the footer's `margin-top: auto` from being the only thing filling the gap:

```css
.hermes-link-preview {
  display: block;
  flex: 0 1 auto;
  width: 100%;
  min-height: 0;
  max-height: 160px;
  margin-top: var(--hc-gap);
  border-radius: 10px;
  object-fit: cover;
  background: color-mix(in srgb, var(--hc-surface) 52%, transparent);
  pointer-events: none;
}
```

`.hermes-link-footer` keeps `margin: auto 0 0 34px` so it stays bottom-anchored when there *is* a preview, and rises naturally when there is not.

- [ ] **Step 4: Verify and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
git add -A
git commit -m "fix: keep long link urls readable and collapse the empty preview slot"
```

---

### Task 5: Content-fit height for the Todo block

A three-task Todo occupies the same 180px as a twelve-task one. Height must follow content — but under `@tldraw/sync` every height change broadcasts to peers, so it is recomputed on discrete events only (task added, removed, toggled), never per-keystroke. The maths is a pure function so it can be tested without rendering.

**Files:**
- Modify: `src/canvas/tldraw/customShape.types.ts` (add `fitTodoBlockHeight`)
- Modify: `src/canvas/tldraw/customShapeUtils.tsx:207-222` (`addTask`, `deleteTask`)
- Test: `src/canvas/tldraw/customShape.types.test.ts` (already exists — append a new `describe` block, do not overwrite it)

**Interfaces:**
- Produces: `export function fitTodoBlockHeight(taskCount: number): number`

- [ ] **Step 1: Write the failing test**

Append this `describe` block to the existing `src/canvas/tldraw/customShape.types.test.ts`, adding `fitTodoBlockHeight` and `HERMES_CARD_MIN_HEIGHT` to its import from `./customShape.types`:

```ts
// HERMES_CARD_MIN_HEIGHT is HERMES_CARD_MIN_WIDTH / HERMES_CARD_ASPECT_RATIO
// = 320 / (16/9) = 180 (customShape.types.ts:9).

describe('fitTodoBlockHeight', () => {
  it('never shrinks below the card minimum', () => {
    expect(fitTodoBlockHeight(0)).toBe(HERMES_CARD_MIN_HEIGHT)
    expect(fitTodoBlockHeight(1)).toBe(HERMES_CARD_MIN_HEIGHT)
  })

  it('grows once the tasks no longer fit', () => {
    expect(fitTodoBlockHeight(12)).toBeGreaterThan(HERMES_CARD_MIN_HEIGHT)
  })

  it('grows monotonically with task count', () => {
    const heights = [4, 8, 12, 20].map(fitTodoBlockHeight)
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1])
    }
  })

  it('adds exactly one row of height per task once past the minimum', () => {
    expect(fitTodoBlockHeight(13) - fitTodoBlockHeight(12)).toBe(28)
  })

  it('treats a negative or non-finite count as empty', () => {
    expect(fitTodoBlockHeight(-3)).toBe(HERMES_CARD_MIN_HEIGHT)
    expect(fitTodoBlockHeight(Number.NaN)).toBe(HERMES_CARD_MIN_HEIGHT)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- customShape.types`
Expected: FAIL — `fitTodoBlockHeight` is not exported.

- [ ] **Step 3: Write the height maths**

Append to `src/canvas/tldraw/customShape.types.ts`:

```ts
/** Chassis padding (top + bottom), header, and the task list's top margin. */
const TODO_CHROME_HEIGHT = 32 + 28 + 10
/** One task row plus the gap beneath it — see .hermes-task-row in styles.css. */
const TODO_ROW_HEIGHT = 24
const TODO_ROW_GAP = 4

/**
 * The height a Todo block needs to show `taskCount` tasks without scrolling.
 * Floors at the shared card minimum so a nearly-empty card keeps its presence.
 */
export function fitTodoBlockHeight(taskCount: number): number {
  const count = Number.isFinite(taskCount) ? Math.max(0, Math.floor(taskCount)) : 0
  const rows = count * (TODO_ROW_HEIGHT + TODO_ROW_GAP)

  return Math.max(HERMES_CARD_MIN_HEIGHT, TODO_CHROME_HEIGHT + rows)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- customShape.types`
Expected: PASS, 5 tests.

- [ ] **Step 5: Drive it from the discrete task events**

In `src/canvas/tldraw/customShapeUtils.tsx`, import `fitTodoBlockHeight` and have `addTask` and `deleteTask` write the height alongside the tasks. Both already build the new `tasks` array — pass its length:

```tsx
    const addTask = (event: MouseEvent<HTMLElement>) => {
      const tasks = [
        ...shape.props.tasks,
        { id: createNextTodoTaskId(shape.props.tasks), text: 'New task', done: false }
      ]

      updateShapeProps(editor, shape, { tasks, h: fitTodoBlockHeight(tasks.length) })
      markCanvasEventHandled(editor, event)
    }
```

```tsx
    const deleteTask = (taskId: string, event: MouseEvent<HTMLElement>) => {
      const tasks = shape.props.tasks.filter((task) => task.id !== taskId)

      updateShapeProps(editor, shape, { tasks, h: fitTodoBlockHeight(tasks.length) })
      markCanvasEventHandled(editor, event)
    }
```

Leave `updateTaskDone` and `updateTaskText` alone — toggling and typing do not change how many rows there are, so they must not resize.

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`. Add tasks to a Todo card past the point where they used to overflow.
Expected: the card grows to fit each new task; deleting shrinks it back, never below the 180px minimum. Typing in a task does not resize the card.

- [ ] **Step 7: Run the suite and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
git add -A
git commit -m "feat: fit todo block height to its task count"
```

---

### Task 6: The `note_card` shape module

Notes are native `geo` rectangles, so their text hugs the top-left corner in a different font from every sibling. This task creates the shape; Task 7 wires it up. Nothing changes behaviourally until Task 7 lands.

**Files:**
- Create: `src/canvas/tldraw/noteCard.types.ts`
- Create: `src/canvas/tldraw/noteCardUtils.tsx`
- Modify: `src/canvas/tldraw/customShapeUtils.tsx:483-488` (`hermesShapeUtils`)
- Modify: `src/canvas/tldraw/tldrawSchema.ts` (store schema entry)
- Modify: `src/styles.css` (add `.hermes-note-card`)
- Test: `src/canvas/tldraw/noteCardUtils.test.tsx`

**Interfaces:**
- Produces:
  - `export const NOTE_CARD_TYPE = 'note_card'`
  - `export type NoteCardProps = { w: number; h: number; title: string; tag: string; content: string; color: TLDefaultColorStyle; backgroundColor?: string }`
  - `export const noteCardMigrations`
  - `export function createNoteCardShapeProps(input: { title: string; tag: string; content?: string; color?: TLDefaultColorStyle; w?: number; h?: number }): NoteCardProps`
  - `export class NoteCardShapeUtil extends BaseHermesCardUtil<NoteCardShape>`

- [ ] **Step 1: Write the failing test**

Create `src/canvas/tldraw/noteCardUtils.test.tsx`. Mirror the `vi.mock('tldraw', ...)` block at the top of `customShapeUtils.test.tsx` — copy it verbatim so the mocked `HTMLContainer`, `useEditor`, `useIsEditing` and `getColorValue` behave identically.

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoteCardShapeUtil } from './noteCardUtils'
import { createNoteCardShapeProps, NOTE_CARD_TYPE } from './noteCard.types'

// NOTE: copy the vi.mock('tldraw', ...) block from customShapeUtils.test.tsx here.

function renderNote(props: Record<string, unknown>) {
  const util = new NoteCardShapeUtil({} as any)
  return render(
    util.component({
      id: 'shape:note_1',
      type: NOTE_CARD_TYPE,
      x: 0, y: 0, rotation: 0, index: 'a1', parentId: 'page:page',
      isLocked: false, opacity: 1, meta: {},
      props: { w: 320, h: 180, title: 'Launch', tag: 'Idea', content: 'Ship it', ...props }
    } as any)
  )
}

describe('NoteCardShapeUtil', () => {
  it('renders on the shared card chassis so it matches its siblings', () => {
    renderNote({})
    expect(screen.getByText('Launch').closest('.hermes-shape')).toBeInTheDocument()
    expect(screen.getByText('Launch').closest('.hermes-note-card')).toBeInTheDocument()
  })

  it('shows the tag as a kicker and the content as the body', () => {
    renderNote({})
    expect(screen.getByText('Idea')).toHaveClass('hermes-card-kicker')
    expect(screen.getByText('Ship it')).toBeInTheDocument()
  })

  it('omits the kicker when there is no tag', () => {
    renderNote({ tag: '' })
    expect(document.querySelector('.hermes-card-kicker')).toBeNull()
  })

  it('carries the accent token from the theme colour', () => {
    renderNote({ color: 'red' })
    expect(screen.getByText('Launch').closest('.hermes-shape')).toHaveStyle({
      '--hc-accent': '#fecaca'
    })
  })
})

describe('createNoteCardShapeProps', () => {
  it('defaults content and dimensions', () => {
    const props = createNoteCardShapeProps({ title: 'A', tag: 'B' })
    expect(props).toMatchObject({ title: 'A', tag: 'B', content: '', w: 320, h: 180 })
  })

  it('rejects a blank title the way the docs card does', () => {
    expect(() => createNoteCardShapeProps({ title: '   ', tag: 'B' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- noteCardUtils`
Expected: FAIL — cannot resolve `./noteCardUtils`.

- [ ] **Step 3: Write the types module**

Create `src/canvas/tldraw/noteCard.types.ts`, following `docsCard.types.ts` exactly:

```ts
import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence
} from '@tldraw/tlschema'
import type { TLDefaultColorStyle } from 'tldraw'

export const NOTE_CARD_TYPE = 'note_card'
export const NOTE_CARD_DEFAULT_WIDTH = 320
export const NOTE_CARD_DEFAULT_HEIGHT = 180
export const NOTE_CARD_MIN_WIDTH = 240
export const NOTE_CARD_MIN_HEIGHT = 140
export const DEFAULT_NOTE_CARD_COLOR: TLDefaultColorStyle = 'yellow'

export type NoteCardProps = {
  w: number
  h: number
  title: string
  tag: string
  content: string
  color: TLDefaultColorStyle
  backgroundColor?: string
}

export type NoteCardInput = {
  title: string
  tag: string
  content?: string
  color?: TLDefaultColorStyle
  w?: number
  h?: number
}

const noteCardVersions = createShapePropsMigrationIds(NOTE_CARD_TYPE, {
  NormalizeDimensions: 1
})

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function fitNoteCardDimensions(w?: number, h?: number) {
  return {
    w: Math.max(NOTE_CARD_MIN_WIDTH, finitePositive(w) ? w : NOTE_CARD_DEFAULT_WIDTH),
    h: Math.max(NOTE_CARD_MIN_HEIGHT, finitePositive(h) ? h : NOTE_CARD_DEFAULT_HEIGHT)
  }
}

function normalizeDimensions(props: Record<string, unknown>) {
  const dimensions = fitNoteCardDimensions(
    typeof props.w === 'number' ? props.w : undefined,
    typeof props.h === 'number' ? props.h : undefined
  )
  props.w = dimensions.w
  props.h = dimensions.h
}

export const noteCardMigrations = createShapePropsMigrationSequence({
  sequence: [{
    id: noteCardVersions.NormalizeDimensions,
    up: normalizeDimensions,
    down: () => {}
  }]
})

export function createNoteCardShapeProps(input: NoteCardInput): NoteCardProps {
  const title = input.title.trim()
  if (!title) throw new Error('Note Card title must not be blank')

  return {
    ...fitNoteCardDimensions(input.w, input.h),
    title,
    tag: input.tag.trim(),
    content: input.content ?? '',
    color: input.color ?? DEFAULT_NOTE_CARD_COLOR
  }
}
```

- [ ] **Step 4: Write the shape util**

Create `src/canvas/tldraw/noteCardUtils.tsx`. `BaseHermesCardUtil`, `cardStyle`, `controlHandlers`, `updateShapeProps` and `enterShapeEditMode` currently live in `customShapeUtils.tsx` — export them from there and import them here rather than duplicating.

```tsx
import { DefaultColorStyle, HTMLContainer, T, useEditor, useIsEditing } from 'tldraw'
import {
  BaseHermesCardUtil,
  cardStyle,
  controlHandlers,
  enterShapeEditMode,
  updateShapeProps
} from './customShapeUtils'
import {
  DEFAULT_NOTE_CARD_COLOR,
  NOTE_CARD_TYPE,
  noteCardMigrations,
  type NoteCardProps
} from './noteCard.types'

function NoteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h6M7 10h5M7 13h3" />
    </svg>
  )
}

export class NoteCardShapeUtil extends BaseHermesCardUtil<any> {
  static override type = NOTE_CARD_TYPE
  static override migrations = noteCardMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    tag: T.string,
    content: T.string,
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): NoteCardProps {
    return {
      w: 320,
      h: 180,
      title: 'New Note',
      tag: 'Idea',
      content: '',
      color: DEFAULT_NOTE_CARD_COLOR
    }
  }

  component(shape: any) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)
    const handlers = controlHandlers(editor)

    if (isEditing) {
      return (
        <HTMLContainer className="hermes-shape hermes-note-card" style={cardStyle(editor, shape.props)}>
          <header className="hermes-card-header">
            <span className="hermes-card-icon"><NoteIcon /></span>
            <input
              className="hermes-inline-title-input"
              value={shape.props.title}
              aria-label="Note title"
              onChange={(event) => updateShapeProps(editor, shape, { title: event.currentTarget.value })}
              {...handlers}
            />
          </header>
          <input
            className="hermes-inline-task-input"
            value={shape.props.tag}
            aria-label="Note tag"
            onChange={(event) => updateShapeProps(editor, shape, { tag: event.currentTarget.value })}
            {...handlers}
          />
          <textarea
            className="hermes-note-body-input"
            value={shape.props.content}
            aria-label="Note content"
            onChange={(event) => updateShapeProps(editor, shape, { content: event.currentTarget.value })}
            {...handlers}
          />
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer
        className="hermes-shape hermes-note-card"
        style={cardStyle(editor, shape.props)}
        onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
      >
        <header className="hermes-card-header">
          <span className="hermes-card-icon"><NoteIcon /></span>
          <strong>{shape.props.title}</strong>
        </header>
        {shape.props.tag ? <p className="hermes-card-kicker">{shape.props.tag}</p> : null}
        {shape.props.content ? <p className="hermes-note-body">{shape.props.content}</p> : null}
      </HTMLContainer>
    )
  }
}
```

Register it in `customShapeUtils.tsx:483-488`:

```tsx
export const hermesShapeUtils = [
  TodoBlockShapeUtil,
  LinkCardShapeUtil,
  ProjectCardShapeUtil,
  DocsCardShapeUtil,
  NoteCardShapeUtil
]
```

`customShapeUtils.test.tsx:60-65` asserts the exact type list and order — update it to include `note_card` last.

Add the store schema entry in `tldrawSchema.ts`, beside `docs_card`:

```ts
      note_card: {
        migrations: noteCardMigrations,
        props: {
          w: T.number,
          h: T.number,
          title: T.string,
          tag: T.string,
          content: T.string,
          color: DefaultColorStyle,
          backgroundColor: T.string.optional()
        }
      }
```

Add the CSS in `styles.css`:

```css
.hermes-note-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hermes-note-body {
  margin-top: 4px;
  color: var(--hc-ink);
  white-space: pre-wrap;
  overflow-y: auto;
  min-height: 0;
}

.hermes-note-body-input {
  flex: 1 1 auto;
  min-height: 0;
  resize: none;
  border: 1px solid var(--hc-line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--hc-surface) 70%, transparent);
  color: var(--hc-ink);
  font: inherit;
  padding: 6px 8px;
}
```

- [ ] **Step 5: Verify and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
git add -A
git commit -m "feat: add the note_card shape on the shared chassis"
```

---

### Task 7: Wire `note_card` into creation and grouping

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts:16` (import), `:110-121` (`create_note_card`)
- Modify: `src/canvas/tldraw/autoFrameLayout.ts:85-92` (`getAutoFrameCardKind`)
- Delete: `src/canvas/tldraw/nativeNoteCard.ts`, `src/canvas/tldraw/nativeNoteCard.test.ts`
- Test: `src/canvas/tldraw/autoFrameLayout.test.ts` (add), `src/canvas/tldraw/tldrawActionExecutor.test.ts` (update)

**Interfaces:**
- Consumes: `NOTE_CARD_TYPE`, `createNoteCardShapeProps` from Task 6.

**The critical constraint:** existing boards hold notes as `geo` rectangles with no marker distinguishing them from hand-drawn rectangles. `getAutoFrameCardKind` must keep returning `'note'` for those, or every existing note falls out of its frame on next reconcile.

- [ ] **Step 1: Write the failing tests**

Add to `src/canvas/tldraw/autoFrameLayout.test.ts`:

```ts
  it('groups the new note_card shape under Notes', () => {
    expect(getAutoFrameCardKind({ type: 'note_card', props: {} } as any)).toBe('note')
  })

  it('still groups legacy geo rectangles under Notes so existing boards keep working', () => {
    expect(getAutoFrameCardKind({ type: 'geo', props: { geo: 'rectangle' } } as any)).toBe('note')
  })

  it('does not claim non-rectangle geo shapes', () => {
    expect(getAutoFrameCardKind({ type: 'geo', props: { geo: 'ellipse' } } as any)).toBeNull()
  })
```

In `src/canvas/tldraw/tldrawActionExecutor.test.ts`, the existing test at **line 337**, `'creates built-in rectangle note cards with formatted rich text'`, asserts `type: 'geo'` and a `richText` document. That whole test is now wrong — rename it and replace its observation assertion:

```ts
  it('creates note cards as note_card shapes', () => {
    const target = createMemoryTldrawTarget('canvas_001')

    expect(
      executeTldrawAction(target, {
        type: 'create_note_card',
        id: 'shape:note_1',
        title: 'Offline Sync',
        tag: 'Idea',
        content: 'Queue writes locally\nFlush when online',
        color: 'light-blue',
        x: 240,
        y: 260
      })
    ).toEqual({ actionType: 'create_note_card', createdShapeIds: ['shape:note_1'] })

    expect(readTldrawObservation(target)).toMatchObject({
      canvasId: 'canvas_001',
      shapes: [
        {
          id: 'shape:note_1',
          type: 'note_card',
          x: 240,
          y: 260,
          props: {
            title: 'Offline Sync',
            tag: 'Idea',
            content: 'Queue writes locally\nFlush when online',
            color: 'light-blue'
          }
        }
      ]
    })
  })
```

**Behaviour change to record:** the original test passes `size: 'l'`, which `createNoteCardProps` mapped to the geo shape's font size. `note_card` has no `size` prop, so the parameter becomes inert. The zod schema still accepts it (`canvasAction.schema.ts:147-156` is not `.strict()`), so existing agent calls do not error — they just stop having a size effect. Drop `size` from the test, and mention the change in Task 8's documentation sweep.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- autoFrameLayout tldrawActionExecutor`
Expected: FAIL — `note_card` maps to `null`, and the executor still emits `geo`.

- [ ] **Step 3: Update the kind mapping**

In `src/canvas/tldraw/autoFrameLayout.ts`, import `NOTE_CARD_TYPE` and add the branch **above** the legacy one:

```ts
export function getAutoFrameCardKind(shape: Pick<AutoFrameLayoutShape, 'type' | 'props'>) {
  if (shape.type === PROJECT_CARD_TYPE) return 'project' as const
  if (shape.type === TODO_BLOCK_TYPE) return 'todo' as const
  if (shape.type === DOCS_CARD_TYPE) return 'docs' as const
  if (shape.type === LINK_CARD_TYPE) return 'link' as const
  if (shape.type === NOTE_CARD_TYPE) return 'note' as const
  // Legacy: notes created before the note_card shape existed are plain geo
  // rectangles. They carry no marker, so they are matched by shape alone and
  // are deliberately never migrated.
  if (shape.type === 'geo' && shape.props.geo === 'rectangle') return 'note' as const
  return null
}
```

- [ ] **Step 4: Switch the executor**

In `src/canvas/tldraw/tldrawActionExecutor.ts`, replace the `nativeNoteCard` import with `createNoteCardShapeProps` from `./noteCard.types`, and rewrite the case:

```ts
    case 'create_note_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, 'note_card'),
        type: NOTE_CARD_TYPE,
        x: action.x,
        y: action.y,
        rotation: 0,
        opacity: 1,
        props: createNoteCardShapeProps(action) as unknown as Record<string, unknown>,
        meta: { source: 'hermes' },
        actionType: action.type
      })
```

Then delete `src/canvas/tldraw/nativeNoteCard.ts` and `src/canvas/tldraw/nativeNoteCard.test.ts` — the executor was their only consumer.

- [ ] **Step 5: Verify in the browser, including the legacy path**

Run `npm run dev`.
Expected: the Note Card toolbar button creates a card on the shared chassis, with padding and a title matching its siblings. The **pre-existing** yellow rectangles still render and still sit inside the green "Notes" frame. Click Tidy — both new note cards and legacy rectangles group under Notes together.

- [ ] **Step 6: Run the suite and commit**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
git add -A
git commit -m "feat: create notes as note_card shapes, keeping legacy geo notes grouped"
```

---

### Task 8: Correct the note contract in the docs and agent surface

Three places tell the agent a note is a native tldraw geo rectangle. After Task 7 that is false. The action name and parameters are unchanged, so no agent code breaks — but its description is now misleading, which is the kind of wrong that produces bad tool calls.

**Files:**
- Modify: `agent_service/canvas_tools.py:637` (tool description)
- Modify: `CANVAS_API.md` (the `create_note_card` section)
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md` (note references)

- [ ] **Step 1: Find every claim**

```bash
grep -rn "native tldraw note\|note card\|note_card" CANVAS_API.md agent_service/canvas_tools.py plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md
```

- [ ] **Step 2: Update the agent tool description**

In `agent_service/canvas_tools.py:637`, change `"Create a native tldraw note card."` to:

```python
        ("create_note_card", "Create a Hermes note card (shape type note_card).", CreateNoteCardArgs, create_note),
```

- [ ] **Step 3: Update the two markdown documents**

In `CANVAS_API.md` and the canvas-dashboard `SKILL.md`, correct any statement that a note is a `geo` rectangle or that its text lives in `richText`. State that `create_note_card` produces a `note_card` shape with `title`, `tag` and `content` props, and note that boards created before this change may still contain notes as `geo` rectangles, which remain supported.

Also record that the `size` parameter is now accepted but inert: it used to set the geo shape's font size, and `note_card` has no equivalent. If either document lists `size` as a `create_note_card` parameter, mark it deprecated rather than removing it — the schema still accepts it, so silently dropping it from the docs would leave existing agent prompts looking valid but doing nothing unexplained.

- [ ] **Step 4: Confirm nothing else references the old contract**

```bash
grep -rn "createNoteCardProps\|richText" agent_service/ CANVAS_API.md plugins/ | grep -i note
```
Expected: no hits describing note cards as rich-text geo shapes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: describe notes as note_card shapes across the agent surface"
```

---

### Task 9: Verify the card family end to end

No new code. The previous tasks each verified their own slice; this checks the goal actually holds.

- [ ] **Step 1: Full verification**

```bash
set -e
npm test > /tmp/t.log 2>&1 || { tail -40 /tmp/t.log; exit 1; }
npm run lint:types > /tmp/tc.log 2>&1 || { cat /tmp/tc.log; exit 1; }
npm run build > /tmp/b.log 2>&1 || { tail -20 /tmp/b.log; exit 1; }
```

- [ ] **Step 2: Confirm the colour discipline actually holds**

```bash
grep -nE '^\.hermes-[^{]*\{[^}]*#[0-9a-fA-F]{3,8}' src/styles.css
```
Expected: no output. This is the same rule the Task 2 guard enforces; checking it independently proves the guard is not vacuous.

- [ ] **Step 3: Walk the five cards**

Run `npm run dev` and insert one of each card kind. Check:

| Check | Expected |
|---|---|
| Chassis | All five share padding, radius, shadow and title size |
| Accent rail | Each shows a distinct accent; the background is a tint of it |
| Note | Text is inset with padding, not jammed in the corner; font matches its siblings |
| Docs | `# Heading` reads as a heading without dwarfing the body |
| Link | A long URL ellipsises and its tooltip shows the full value |
| Todo | Adding tasks past the fold grows the card; typing does not |
| Legacy notes | Pre-existing yellow rectangles still render and still group under Notes |

- [ ] **Step 4: Confirm sync did not regress**

With the app open, add three tasks to a Todo card, then reload the page.
Expected: the card returns at its grown height with all three tasks — the height change persisted through `@tldraw/sync` rather than being local-only.

- [ ] **Step 5: Commit any fixes**

If steps 2-4 surfaced defects, fix and commit. If everything passed there is nothing to commit — say so rather than creating an empty commit.

---

## Self-Review

**Spec coverage** — every Phase B requirement in `2026-07-26-canvas-ui-ux-redesign-design.md` maps to a task:

| Spec requirement | Task |
|---|---|
| `.tl-container`-scoped `--hc-*` token layer | 1 |
| `--hc-accent` means accent only; background derived | 2 |
| No hex literals in `.hermes-*` rules, enforced by a test | 2, 9 |
| One chassis: padding, radius, shadow, type scale, states | 1 |
| Accent rail + header/body/footer anatomy | 1, 6 |
| Todo fits content on discrete events, never per-keystroke | 5 |
| Docs stays fixed and scrollable | untouched by design |
| Project and Link stay fixed; Link preview collapses | 4 |
| Note promoted to a real shape on the chassis | 6, 7 |
| No automatic migration; legacy geo notes keep working | 7 |
| Docs heading scale compressed (1.25× / 1.12× / 1.0×) | 3 |
| Link long-URL ellipsis + tooltip | 4 |

**Gaps this plan closes that the spec did not anticipate:** the auto-frame dual mapping (Task 7 step 3), the cross-boundary documentation (Task 8), and the two existing assertions in `customShapeUtils.test.tsx:421,450` plus the shape-list assertion at `:60-65` (Tasks 2 and 6). These were found by reading the code, and are called out because the Phase A execution showed that unplanned test conflicts are what actually cost time.

**Type consistency** — `fitTodoBlockHeight(taskCount: number): number` is defined in Task 5 and consumed there only. `NOTE_CARD_TYPE`, `noteCardMigrations` and `createNoteCardShapeProps` are defined in Task 6 and consumed in Task 7. `cardStyle` returns `--hc-accent` in Task 2 and is consumed by `NoteCardShapeUtil` in Task 6 — Task 6 therefore depends on Task 2 having landed, which the ordering respects.

**Known risk:** Task 6 requires exporting `BaseHermesCardUtil`, `cardStyle`, `controlHandlers`, `enterShapeEditMode` and `updateShapeProps` from `customShapeUtils.tsx`, which are currently module-private. If that file has grown unwieldy by then, moving those five into a `cardChassis.tsx` module is a reasonable in-flight refactor — but do it as its own commit, not folded into Task 6.
