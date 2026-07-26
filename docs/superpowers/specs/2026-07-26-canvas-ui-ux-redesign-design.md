# Canvas UI/UX Redesign

Date: 2026-07-26
Status: Approved

## Problem

The canvas surface has grown by accretion. Four distinct problems, all observed on the running app:

**Chrome clutter.** Six floating clusters occupy five corners in three unrelated visual
languages: tldraw's menu strip (top-left), tldraw's style panel (top-right, always open,
sitting over the Docs cards), tldraw's full drawing toolbar (bottom-centre), the Hermes
insert pill (bottom-right, overlapping a card), and the zoom control plus the collapsed
chat FAB (bottom-left, colliding with each other).

**No cohesion.** There is no token layer for the canvas. The `:root` custom properties in
`styles.css:1-26` are a *dark* palette serving the debug dashboard, so the light pastel
cards cannot use them. Each card was therefore styled by hand and drifted:

```
.hermes-shape          background #ffffff   color #25252d   padding 14px 16px
.hermes-todo-block     background #f4fbf4
.hermes-task-card      background #dbeafe
.hermes-docs-card      background #fffdf8
.hermes-card-icon      color #6c5ce7
.hermes-progress-badge color #376c41
.hermes-docs-open-button color #5b4cc4
.hermes-link-card icon color #2864aa
```

`--hermes-card-accent` compounds this: it is assigned the card's *background*
(`customShapeUtils.tsx:151`), then `.hermes-link-card` runs `color-mix` against it to derive
a border and an icon colour. The token means "background" in one place and "accent" in
another, and the resulting specificity fight forced an `!important`.

**Card interiors.** Note cards are native tldraw `geo` rectangles, so text hugs the top-left
corner with no padding and renders in a different font from every sibling card. Cards are
fixed-height with `overflow: hidden`, so a three-task Todo occupies the same 180px as a
twelve-task one. Docs markdown headings are unscaled — an `h1` renders enormous over
near-unreadable body text. Long Link URLs clip.

**Interaction gaps.** No onboarding or empty state. `alert()` used for errors at
`CanvasInsertMenu.tsx:166` and `Simulator.tsx:93`. The three portal modals put `onKeyDown`
on a backdrop `div` with no `tabIndex`, so Escape only fires when a child input happens to
hold focus.

## Approach

Three phases against one shared foundation, sequenced A → B → C. A settles what surrounds
the cards, B restyles them inside that frame, C polishes. Each phase ships independently.

The chrome strategy is **curate and merge**, not custom chrome: tldraw's UI is retained and
reshaped through its `overrides` and `components` APIs. This keeps its shortcuts dialog,
toasts, dialogs and accessibility work, and keeps tldraw upgrades cheap.

---

## Foundation: canvas token layer

New file `src/canvas/tldraw/canvasTokens.css`, scoped to `.tl-container` so canvas tokens
cannot collide with the dark dashboard tokens in `:root`.

```css
.tl-container {
  --hc-surface: #ffffff;        /* card base */
  --hc-ink: #25252d;            /* body text */
  --hc-ink-strong: #202027;     /* titles */
  --hc-ink-muted: #6b7280;      /* kickers, meta */
  --hc-line: rgba(0,0,0,.10);   /* hairlines */
  --hc-accent: #6c5ce7;         /* per-card, overridden inline */
  --hc-tint: color-mix(in srgb, var(--hc-accent) 8%, var(--hc-surface));

  --hc-pad: 16px;  --hc-gap: 10px;  --hc-radius: 14px;
  --hc-title: 16px/1.35;  --hc-body: 14px/1.45;  --hc-meta: 12px/1.2;
  --hc-shadow: 0 2px 8px rgba(42,39,65,.08), 0 12px 28px rgba(42,39,65,.05);
}
```

Two rules follow:

1. **`--hc-accent` means accent, only.** Each shape sets one inline accent value derived
   from its tldraw theme colour; the card background becomes `--hc-tint`, derived from the
   accent. This removes the five hardcoded card backgrounds and the `!important` on
   `.hermes-link-card`.
2. **No hex literals in `.hermes-*` rules.** Every colour routes through a token.

Cards keep their identity through the accent — Todo green, Link blue, Docs amber, Project
violet, Note yellow — rather than through five independently invented palettes.

---

## Phase A: Chrome

### One toolbar

`CanvasInsertMenu` stops being a floating pill and becomes the leading group inside
tldraw's toolbar, via `components.Toolbar`.

```
┌─────────────────────────────────────────┐
│  ▣  ▤  ☑  ↗  ▤  │  ↖  ✋  ↗  T  ✎  ⌫  │
└─────────────────────────────────────────┘
  Project Todo Link     Select Hand Arrow
  Note Docs             Text Draw Eraser
      insert        │        tools
```

The two groups behave differently and must read differently. **Inserts are
click-to-create**: create at viewport centre, then select — exactly the current
`CanvasInsertMenu` behaviour, which moves without changing. Their disabled-until-ready
state is preserved. **Tools are modal toggles** with a persistent active state. A divider
plus the active-state treatment carries the distinction.

### Trimmed tool set

Retained: **Select, Hand, Arrow, Text, Draw, Eraser**.

Dropped from `overrides.tools`: **note, media, geo/rect, frame, laser, highlight, line**.

Dropping a tool from the override also removes its keyboard shortcut, so `N` no longer
spawns a tldraw sticky that competes with the Hermes Note Card. Manual frames are dropped
because they would fight the auto-frame reconciler. Eleven items fit without the toolbar's
overflow chevron, so it disappears.

### Conditional style panel

`components.StylePanel` returns `null` unless the selection contains a native shape (draw,
text, arrow, line) or such a tool is active. Selecting a Hermes card shows nothing — its
colour comes from the accent token, not the style panel. This reclaims the entire top-right
quadrant.

### Tidy becomes an action

`CanvasTidyButton` leaves the floating pill and joins the top-left cluster beside undo and
redo, via `components.QuickActions`. It operates on the whole board the way undo does, so
it belongs with the actions rather than in the insert or tool groups.

### Resulting corners

| Corner | Owner |
|---|---|
| top-left | menu · page · undo · redo · **Tidy** |
| top-right | style panel — *only when a native shape is selected* |
| bottom-left | zoom · minimap toggle |
| bottom-centre | the single toolbar |
| right edge | chat panel and its collapsed FAB |

The chat FAB moving to the right edge ends its collision with the zoom control, and chat
flips from `left: 14px` to `right: 14px` (`chat.css:33-34`) — which is what
`2026-07-17-floating-right-chat-panel-design.md` specified.

### Files

- New: `src/canvas/tldraw/uiOverrides.ts` — the `tools` override, a pure config object.
- New: `src/canvas/components/CanvasToolbar.tsx`
- New: `src/canvas/components/CanvasStylePanel.tsx`
- Changed: `CanvasSurface.tsx:145-160` grows a `components` map alongside the existing
  `ContextMenu`.
- Changed: `CanvasInsertMenu.tsx` — insert *behaviour* stays; only its rendering moves.
- Deleted: `styles.css:691-710`, the floating pill container and
  `.canvas-insert-actions { display: contents }`.

---

## Phase B: Cards

### One chassis, five accents

Every card shares an anatomy so the board is scannable:

```
┌────────────────────────────┐
│ ▬▬▬                        │  accent rail (3px, --hc-accent)
│                            │
│  ◇  Title            1/3   │  header: icon · title · meta slot
│                            │
│  body                      │  body: card-specific
│                            │
│  footer                    │  footer: optional
└────────────────────────────┘
   --hc-pad on all sides
```

`.hermes-shape` is rebuilt on the foundation tokens and becomes the only place padding,
radius, shadow, border and type scale are defined. The five card rules keep only what
genuinely differs: their accent and their body layout. Icon colour, title size, meta badge
and hairlines stop being per-card decisions. States — `hover`, `selected`, `:focus-within`,
editing — get one shared treatment, replacing today's focus-only ring.

### Content-fit height

Cards are fixed-height and `overflow: hidden`, producing dead space. Auto-height under
`@tldraw/sync` broadcasts to peers on every change, so the fix is scoped deliberately:

- **Todo and Note fit their content**, recomputed on *discrete* events only — task
  added, removed or toggled; text edit committed. Never per-keystroke. Height grows from
  the existing min-height and never shrinks below it.
- **Docs stays fixed and scrollable.** It is an unbounded document; fitting it would
  produce metre-tall cards.
- **Project and Link stay fixed**, but their interiors gain proper `flex` fill so the space
  reads as intentional. Link's preview slot collapses when there is no image, letting the
  URL footer rise rather than float below a void.

### Note card promotion

`note_card` becomes a real Hermes shape on the shared chassis, replacing
`nativeNoteCard.ts`'s geo-rectangle construction for newly created notes.

**No automatic migration.** Existing notes are plain tldraw `geo` rectangles carrying no
marker that distinguishes them from any hand-drawn rectangle, so a conversion pass would
have to guess, and could rewrite shapes the user drew themselves. New notes are
`note_card`; existing geo rectangles stay geo rectangles and remain usable. A manual
"convert to Note Card" action is out of scope.

### Docs markdown scale

Headings get a compressed scale relative to `--hc-body` — h1 1.25×, h2 1.12×, h3 1.0× —
with weight rather than size carrying the hierarchy. These are read at 44% zoom on a
canvas, not full-width in a document.

### Link card overflow

Long URLs get `text-overflow: ellipsis` plus a `title` tooltip, replacing today's clipping.

---

## Phase C: Interaction polish

### Empty canvas state

A centred, non-interactive hint renders on the tldraw surface when the board holds zero
shapes, naming the insert group and pointing at the chat panel. It disappears on the first
shape and never returns. No dismissal state to persist, no tour, no coach marks.

### Real toasts

`CanvasInsertMenu.tsx:166` and `Simulator.tsx:93` move from `alert()` to tldraw's
`useToasts`, already proven in `CanvasContextMenu.tsx:22-28`. No new dependency; one toast
mechanism for the app.

### Dismissible modals

One shared `useModalDismiss` hook, applied to `DocsCardModal`, `DocsCardReaderPanel` and
the link modal, replacing three divergent copies. It provides: focus moved to the modal on
open, focus trapped inside while open, focus restored to the opener on close, Escape
working regardless of what is focused, and backdrop click to dismiss.

### Cut

Feedback for agent-driven canvas changes. `ToolActivity.tsx` already reports every tool
call in the chat panel; a toast or shape pulse would duplicate that signal.

---

## Isolation

Each piece has one owner and a testable seam.

- `canvasTokens.css` owns the visual vocabulary and imports no logic.
- `uiOverrides.ts` is a pure config object, assertable without rendering.
- `CanvasToolbar` and `CanvasStylePanel` are presentational. Insert *behaviour* stays in
  the existing bridge-dispatch functions, so relocating the buttons cannot change what they
  do.
- `useModalDismiss` is testable against a bare div.

## Testing

Following the existing component-test pattern:

- `uiOverrides` excludes note, media, geo, frame, laser, highlight and line.
- `CanvasStylePanel` returns null for a Hermes-card selection and renders for a native one.
- Todo height grows on task add and floors at its min-height.
- `useModalDismiss` restores focus to the opener and handles Escape raised from the
  backdrop.
- The empty-state hint appears at zero shapes and not at one.
- A guard asserting `.hermes-*` rules in `styles.css` contain no hex literals — the
  foundation rule only holds if something checks it.

## Out of scope

- Dark mode for the canvas
- Draggable or resizable chat panel
- Reworking the debug dashboard
- Touch and mobile layouts
- The unbuilt PDF viewer panel (`docs/superpowers/plans/2026-07-10-pdf-viewer-panel.md`)
- Converting existing geo rectangles to Note Cards
