# Fullscreen Canvas Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen canvas page that makes the Excalidraw surface easier to view.

**Architecture:** Keep the app router-free by reading `window.location.search` in `App.tsx`. Render either the existing workspace or a fullscreen canvas view that reuses `CanvasSurface` and the existing bridge status UI.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, plain CSS.

---

### Task 1: App View Tests

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that render the default workspace and `?view=canvas` mode:

```ts
expect(screen.getByRole('link', { name: /fullscreen/i })).toHaveAttribute('href', '?view=canvas')
expect(screen.getByText('Fullscreen Canvas')).toBeInTheDocument()
expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/')
```

- [ ] **Step 2: Run the test**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the fullscreen link and page do not exist.

### Task 2: App Implementation

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add query-string view selection**

Use `new URLSearchParams(window.location.search).get('view') === 'canvas'`.

- [ ] **Step 2: Add fullscreen render branch**

Render a top bar, status pill, back link, and `<CanvasSurface />` inside a fullscreen container.

- [ ] **Step 3: Add dashboard fullscreen link**

Add a `Fullscreen` link to the existing canvas header.

- [ ] **Step 4: Run the test**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

### Task 3: CSS And Verification

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add fullscreen page styles**

Add `.fullscreen-canvas-page`, `.fullscreen-canvas-topbar`, `.fullscreen-canvas-container`, and `.canvas-header-actions` styles.

- [ ] **Step 2: Run verification**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

Run: `npm run lint:types`

Expected: PASS.
