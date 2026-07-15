# Bright Frame Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan step-by-step.

**Goal:** Make the four automatic card-group frame categories easier to distinguish with vivid outlines and soft tinted frame surfaces, without changing card or note colors.

**Architecture:** Keep the existing pastel theme as the source of truth. Add optional frame-role overrides to the palette builder so only `frameHeadingStroke`, `frameHeadingFill`, `frameStroke`, `frameFill`, and `frameText` differ for `light-violet`, `yellow`, `green`, and `light-blue`.

**Tech Stack:** TypeScript, tldraw theme tokens, Vitest, Vite.

## Global Constraints

- Do not alter the card, note, fill, solid, highlight, or shape color tokens.
- Do not change auto-frame reconciliation, frame metadata, or card layout behavior.
- Keep manual frames unchanged unless they deliberately use one of the four updated color styles.

## Task 1: Add frame-only palette overrides

**Files:**
- Modify: `src/canvas/tldraw/pastelTheme.test.ts`
- Modify: `src/canvas/tldraw/pastelTheme.ts`

1. Add failing assertions for the exact light and dark frame token values of `light-violet`, `yellow`, `green`, and `light-blue`.
2. Add regression assertions proving representative `solid` and `noteFill` tokens retain their previous values.
3. Run `npm test -- src/canvas/tldraw/pastelTheme.test.ts` and confirm the new assertions fail before implementation.
4. Add a typed frame-role override map and allow the existing palette helper to receive an optional override for each color style.
5. Apply the approved light and dark values only to the four frame categories; preserve all non-frame values from the current palette.
6. Re-run `npm test -- src/canvas/tldraw/pastelTheme.test.ts` and confirm it passes.
7. Run `npm run lint:types`, `npm run build`, and `npm test`.

## Verification

- The focused theme test proves each approved frame token.
- The regression checks prove card/note palette tokens are unchanged.
- Typecheck, production build, and full test suite pass.
