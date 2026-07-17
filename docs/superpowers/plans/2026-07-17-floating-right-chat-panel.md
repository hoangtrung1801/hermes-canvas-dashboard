# Floating Right Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the existing canvas assistant as a rounded, inset overlay on the canvas's right edge without resizing the tldraw viewport.

**Architecture:** Keep the current React component and Zustand boundaries unchanged. Express the new geometry entirely in the chat stylesheet: the workspace becomes a positioning context, the canvas remains full-size, and the expanded and collapsed chat surfaces use absolute desktop positioning while retaining the existing fixed mobile drawer rules.

**Tech Stack:** React 19, TypeScript, plain CSS, Vitest, Testing Library, Vite, tldraw 5.

## Global Constraints

- Desktop expanded chat uses top, right, and bottom insets of exactly `14px`.
- Desktop expanded chat width is exactly `clamp(300px, 28vw, 360px)`.
- The canvas remains full width underneath chat and receives no chat-dependent padding or margin.
- At `760px` and below, retain the current fixed drawer width of `min(92vw, 360px)` and viewport-height behavior.
- Preserve current chat state, streaming, conversations, cancellation, errors, accessibility labels, 44px targets, and reduced-motion behavior.
- Do not add drag, resize, agent, API, persistence, or debug-dashboard behavior.
- Do not modify the user's current changes in `src/styles.css`, `src/canvas/tldraw/customShapeUtils.tsx`, or `src/canvas/tldraw/customShapeUtils.test.tsx`.
- Use test-driven development and observe each focused test fail before changing production CSS.

## File map

- `src/chat/chat.css`: owns fullscreen chat workspace geometry, desktop floating panel treatment, collapsed floating control, and the existing mobile overrides.
- `src/chat/ChatSidebar.test.tsx`: keeps interaction tests and adds stylesheet regressions for overlay geometry and full-size canvas behavior.

---

### Task 1: Desktop floating overlay geometry

**Files:**
- Modify: `src/chat/ChatSidebar.test.tsx`
- Modify: `src/chat/chat.css`

**Interfaces:**
- Consumes: the existing `.chat-workspace`, `.fullscreen-canvas-container`, `.chat-sidebar`, and `.chat-expand` class names rendered by `App` and `ChatSidebar`.
- Produces: desktop overlay geometry without any React prop, state, or API changes.

- [ ] **Step 1: Write failing stylesheet regression tests**

Add `readFileSync` to the existing imports and append these tests:

```tsx
import { readFileSync } from 'node:fs'

it('floats the expanded assistant over the desktop canvas', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const sidebarRule = styles.match(/^\.chat-sidebar \{(?<body>[\s\S]*?)\n\}/m)

  expect(sidebarRule?.groups?.body).toMatch(/position:\s*absolute;/)
  expect(sidebarRule?.groups?.body).toMatch(/top:\s*14px;/)
  expect(sidebarRule?.groups?.body).toMatch(/right:\s*14px;/)
  expect(sidebarRule?.groups?.body).toMatch(/bottom:\s*14px;/)
  expect(sidebarRule?.groups?.body).toMatch(/width:\s*clamp\(300px, 28vw, 360px\);/)
  expect(sidebarRule?.groups?.body).toMatch(/border-radius:\s*24px;/)
})

it('keeps the canvas full size beneath the assistant overlay', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const workspaceRule = styles.match(/^\.chat-workspace \{(?<body>[\s\S]*?)\n\}/m)
  const canvasRule = styles.match(
    /^\.chat-workspace > \.fullscreen-canvas-container \{(?<body>[\s\S]*?)\n\}/m
  )

  expect(workspaceRule?.groups?.body).toMatch(/position:\s*relative;/)
  expect(canvasRule?.groups?.body).toMatch(/width:\s*100%;/)
  expect(canvasRule?.groups?.body).not.toMatch(/margin-right|padding-right/)
})

it('uses a compact floating desktop control when chat is collapsed', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const expandRule = styles.match(/^\.chat-expand \{(?<body>[\s\S]*?)\n\}/m)

  expect(expandRule?.groups?.body).toMatch(/position:\s*absolute;/)
  expect(expandRule?.groups?.body).toMatch(/top:\s*14px;/)
  expect(expandRule?.groups?.body).toMatch(/right:\s*14px;/)
  expect(expandRule?.groups?.body).toMatch(/border-radius:\s*16px;/)
})

it('keeps the collapsed control bottom anchored on mobile', () => {
  const styles = readFileSync('src/chat/chat.css', 'utf8')
  const mobileExpandRule = styles.match(
    /@media \(max-width: 760px\) \{[\s\S]*?  \.chat-expand \{(?<body>[\s\S]*?)\n  \}/
  )

  expect(mobileExpandRule?.groups?.body).toMatch(/top:\s*auto;/)
  expect(mobileExpandRule?.groups?.body).toMatch(/bottom:\s*max\(74px,/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/chat/ChatSidebar.test.tsx`

Expected: the four new tests fail because the current desktop sidebar is a relative 360px flex sibling, the workspace is not a positioning context, the collapsed control is a full-height flex rail, and the mobile rule does not reset the new desktop top inset.

- [ ] **Step 3: Implement the minimal desktop overlay CSS**

Update the existing rules in `src/chat/chat.css` to express the approved geometry:

```css
.chat-workspace {
  position: relative;
  isolation: isolate;
}

.chat-workspace > .fullscreen-canvas-container {
  width: 100%;
  height: 100%;
  min-width: 0;
}

.chat-sidebar {
  position: absolute;
  z-index: 20;
  top: 14px;
  right: 14px;
  bottom: 14px;
  display: flex;
  width: clamp(300px, 28vw, 360px);
  min-width: 0;
  height: auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--chat-border);
  border-radius: 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(56, 189, 248, 0.1), transparent 30%),
    var(--chat-surface);
  color: var(--chat-copy);
  box-shadow: 0 24px 64px rgba(2, 8, 23, 0.38);
}

.chat-expand {
  position: absolute;
  z-index: 20;
  top: 14px;
  right: 14px;
  width: 52px;
  height: 52px;
  align-content: center;
  gap: 5px;
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  background: var(--chat-surface);
  color: #7dd3fc;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  box-shadow: 0 12px 32px rgba(2, 8, 23, 0.32);
}
```

Keep the existing `@media (max-width: 760px)` rules. In the mobile `.chat-sidebar` override, add `border-radius: 0` so the fixed drawer continues to meet the viewport edges. In the mobile `.chat-expand` override, add `top: auto` before the existing `bottom` declaration so the desktop top inset does not override bottom-safe-area positioning.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/chat/ChatSidebar.test.tsx`

Expected: `7 passed`.

- [ ] **Step 5: Commit the overlay implementation**

```bash
git add src/chat/chat.css src/chat/ChatSidebar.test.tsx
git commit -m "feat: float canvas chat on the right"
```

---

### Task 2: Responsive and visual verification

**Files:**
- Verify: `src/chat/chat.css`
- Verify: `src/chat/ChatSidebar.tsx`
- Verify: `src/App.tsx`

**Interfaces:**
- Consumes: the CSS geometry from Task 1 and the existing collapse/expand interaction.
- Produces: verified desktop and mobile layouts with no additional public interface.

- [ ] **Step 1: Run the complete automated verification suite**

Run each command and require exit code `0`:

```bash
npm test
npm run build
.venv/bin/ruff check agent_service tests
.venv/bin/python -m pytest -q
git diff --check
```

Expected: all 189 or more TypeScript tests pass, all 39 or more Python tests pass, Ruff reports `All checks passed!`, Vite completes a production build, and `git diff --check` prints no errors.

- [ ] **Step 2: Verify desktop expanded layout in the browser**

Open the local app at a `1440 × 900` viewport and confirm:

- The assistant is inset 14px from the top, right, and bottom.
- The panel width is between 300px and 360px and its corners are rounded.
- The canvas fills the full viewport behind the panel.
- The chat header and composer remain visible while only the timeline scrolls.

- [ ] **Step 3: Verify collapse without canvas resizing**

Record the canvas container's width, collapse chat, and record the width again. The values must be equal. Confirm the compact AI control appears at the top-right and reopens the assistant with keyboard and pointer input.

- [ ] **Step 4: Verify mobile layout**

At a `390 × 844` viewport, confirm expanded chat is a fixed right drawer no wider than 92vw, fills the dynamic viewport height, has square viewport-edge corners, and the collapsed control appears above the bottom safe area.

- [ ] **Step 5: Inspect the final workspace diff**

Run:

```bash
git status --short
git show --stat --oneline HEAD
```

Expected: the implementation commit contains only `src/chat/chat.css` and `src/chat/ChatSidebar.test.tsx`; the user's pre-existing task-card files remain unstaged and unchanged by this work.
