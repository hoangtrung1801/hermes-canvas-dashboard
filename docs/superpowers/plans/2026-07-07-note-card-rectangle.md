# Note Card Rectangle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `create_note_card` as the public API while creating built-in tldraw rectangle shapes instead of native note shapes.

**Architecture:** Replace the native note helper with a geo rectangle helper. The action schema and public API remain stable; only the executor-created shape type/props and tests/docs expectations change.

**Tech Stack:** TypeScript, React, Vitest, tldraw.

---

### Task 1: Replace Native Note Helper With Rectangle Helper

**Files:**
- Rename/replace: `src/canvas/tldraw/nativeNoteCard.ts`
- Rename/replace test: `src/canvas/tldraw/nativeNoteCard.test.ts`

- [ ] Write tests expecting `createNoteCardProps` to return `geo: "rectangle"`, `w`, `h`, `fill`, `richText`, and no native note-only props.
- [ ] Run `npm test -- src/canvas/tldraw/nativeNoteCard.test.ts` and confirm it fails.
- [ ] Replace helper implementation to return tldraw geo rectangle props.
- [ ] Run the focused helper test and confirm it passes.

### Task 2: Update Executor And Integration Expectations

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Modify tests that currently expect `type: "note"` for `create_note_card`.

- [ ] Update `create_note_card` executor branch to create `type: "geo"` and use a geo id prefix.
- [ ] Update executor, CanvasSurface, headless, and gateway tests to expect `type: "geo"` and rectangle rich text props.
- [ ] Run the focused affected tests and confirm they pass.

### Task 3: Update Active Docs And Verify

**Files:**
- Modify: `README.md`
- Modify: `CANVAS_API.md`
- Modify: `plugins/canvas-dashboard/skills/canvas-dashboard/SKILL.md`

- [ ] Update note-card docs to describe a built-in rectangle with text.
- [ ] Run `npm test`, `npm run lint:types`, and `python3 -m unittest plugins/canvas-dashboard/test_tools.py`.
- [ ] Commit the implementation.
