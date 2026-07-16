# Docs Card Design

**Status:** Approved design
**Date:** July 16, 2026
**Scope:** A persistent long-form Markdown document card for the Hermes canvas

## Context

Hermes Canvas already has a compact native Note Card, plus custom Todo, Link, and Project cards. The Note Card is intentionally left unchanged. This feature adds a separate Docs Card for saving and reading long messages, documents, and other long text directly on the canvas.

The existing tldraw schema, sync persistence, canvas action protocol, browser and headless executors, observations, insert menu, and auto-frame layout are the integration foundation.

## Goals

- Add a dedicated `docs_card` shape for long-form Markdown content.
- Store one document as a title and Markdown source in one persisted tldraw shape.
- Render the full document in a vertically scrollable canvas card.
- Provide a focused Markdown editor in an accessible modal, with rendered Markdown shown on the canvas.
- Autosave title and content while the user types.
- Create Docs Cards from both the canvas insert menu and the Hermes `canvas.action` API.
- Keep live-browser and headless action execution behavior equivalent.
- Include Docs Cards in observations and automatic card grouping/layout.

## Non-goals

This feature does not change Note Cards or migrate existing notes. It does not include file uploads, attachments, external document links, document search, export, version history, collaborative presence, or document-level permissions. It supports common Markdown only: headings, paragraphs, bold/italic, links, bullet and numbered lists, blockquotes, inline code, and fenced code blocks. Tables, task lists, strikethrough, and other extended GFM features are excluded from v1.

## Chosen approach

Implement a dedicated custom `docs_card` tldraw shape. The shape utility owns the card renderer, scrollable body, resize behavior, and edit-modal trigger. The card stores the Markdown source rather than a second rich-text representation, so the source remains lossless and can be sent through Hermes actions and observations.

The Markdown preview uses a vetted parser configured for the supported subset, with raw HTML disabled or safely escaped and URL handling restricted to safe navigable links. The exact parser package is an implementation detail of the plan; the security and rendering behavior are part of this design.

Reusing native `geo` shapes was rejected because their rich-text model does not preserve Markdown source and does not provide a natural scrollable document surface. Storing document data only in generic shape metadata was rejected because it weakens validation, migrations, observations, and future document actions.

## Architecture

The feature is divided into focused units:

1. **Docs-card model:** type constants, dimensions, defaults, validators, migrations, and prop creation.
2. **Docs-card shape utility:** canvas rendering, scroll isolation, resize rules, modal state, and tldraw prop updates.
3. **Markdown preview:** conversion of supported Markdown source to safe rendered output and a deterministic parse-error state.
4. **Canvas action contract:** typed and schema-validated create/update actions.
5. **Action execution:** shared prop creation and update behavior for the live editor and in-memory target.
6. **Canvas integration:** insert-menu creation, schema registration, observations, and auto-frame classification.

All document state remains in the tldraw shape record. There is no secondary document store.

## Data model

```ts
const DOCS_CARD_TYPE = 'docs_card'

type DocsCardProps = {
  w: number
  h: number
  title: string
  content: string
}
```

Defaults:

- Title: `New Document`
- Content: `''`
- Dimensions: `480 × 640` canvas units
- Minimum dimensions: `320 × 360` canvas units

Width and height are independently resizable. The Docs Card does not lock its aspect ratio. Resizing changes only `w` and `h`; it never changes or truncates `content`.

Stored titles are non-empty after trimming. Markdown content may be empty and otherwise remains exactly as entered, including line breaks and Markdown syntax. A shape-props migration sequence is registered for the new shape so future prop changes have an explicit compatibility path, even though v1 has no legacy Docs Card records to migrate.

## Card layout and editing

The canvas card contains:

1. A header with a document icon, title, and an `Edit` control.
2. A body that renders the entire Markdown document.
3. An empty state, `Click Edit to add content`, when content is empty.

The body is vertically scrollable. Wheel and pointer interactions used inside the reading surface stop propagation to tldraw so users can read without panning or zooming the canvas. Normal selection and movement remain available from the card chrome. The card title and body are not edited inline.

Activating `Edit` opens an accessible modal dialog rendered through a portal. The modal contains:

- A title input.
- A Markdown source textarea.
- A close button.

The canvas display remains the rendered Markdown reading surface and is vertically scrollable. Escape and the close button close the modal. Changes autosave with a short debounce while typing; closing the modal never discards changes because committed values have already been written to the shape. Pointer events from inputs, buttons, text selection, and scrolling are marked as handled so they do not move or deselect the shape.

The preview supports headings, paragraphs, emphasis, links, unordered and ordered lists, blockquotes, inline code, and fenced code blocks. Raw HTML is escaped or disabled. Links use safe URL handling and accessible external-link behavior. If parsing fails, the source remains untouched and the preview displays a compact error state.

## Canvas actions

### `create_docs_card`

Creates a Docs Card from:

- Optional `id`.
- Required non-empty `title`.
- Optional `content` Markdown source.
- Required `x` and `y` position.
- Optional positive `w` and `h` dimensions.

Omitted content uses the empty string. Omitted dimensions use the default size and all dimensions normalize to the minimum bounds.

Example:

```json
{
  "type": "create_docs_card",
  "id": "shape:docs_release-notes",
  "title": "Release notes",
  "content": "# Release notes\n\n- Added offline sync\n- Improved startup",
  "x": 420,
  "y": 240
}
```

### `update_docs_card`

Updates a Docs Card by `shapeId`. The action accepts an optional non-empty `title` and optional `content`; at least one field is required. Title values are trimmed before storage. Content is stored as supplied. The target must exist and have type `docs_card`.

Example:

```json
{
  "type": "update_docs_card",
  "shapeId": "shape:docs_release-notes",
  "content": "# Release notes\n\nUpdated after QA."
}
```

The existing generic shape actions continue to handle movement, resizing, selection, coloring where supported, and deletion. The focused update action gives Hermes a typed path for replacing long document content without requiring knowledge of the shape's full tldraw prop record.

## Data flow and integration

### Human path

1. The user chooses `Docs Card` in the insert menu.
2. The menu sends a `create_docs_card` action through the existing `CanvasBridge` and selects the created shape.
3. The user opens the modal and edits title or Markdown source.
4. Debounced updates call the mounted tldraw editor with the changed props.
5. Tldraw sync persists the shape and distributes it to other connected views.

### Hermes path

1. Hermes sends a schema-valid `canvas.action` envelope.
2. The bridge routes the action to the live editor or the headless executor.
3. The executor creates or updates one `docs_card` record using shared model helpers.
4. The result and normalized observation are returned through the existing protocol.

The insert menu uses the viewport center, the `New Document` title, empty content, and the default portrait dimensions. Auto-frame layout recognizes `docs_card` as the `docs` category, creates a `Docs` frame when needed, uses the card's actual dimensions for packing, and orders categories as `project`, `todo`, `docs`, `note`, `link`.

Observations include the shape's `id`, type, position, dimensions, title, complete Markdown `content`, and metadata. No excerpt replaces the source in observations.

## Validation and error handling

- Titles must contain non-whitespace text after trimming.
- Content may be empty and is not silently truncated.
- Positions must be finite numbers.
- Dimensions must be finite and positive, then normalize to the default minimums.
- `update_docs_card` must specify at least one field.
- Create/update execution rejects missing shapes and shapes of the wrong type.
- Failed actions return an action-level error and do not partially mutate the target shape.
- Markdown parser failures affect only the canvas display; source editing and autosave remain available.
- Unsafe or unsupported links are rendered as non-navigable text or rejected by the preview renderer.

Envelope validation uses existing request-level behavior. Browser and headless routes return equivalent action results and observations.

## Testing strategy

### Model and protocol

- Defaults, title trimming, empty content, dimension fitting, and independent resize behavior
- Shape schema registration and migration wiring
- Valid and invalid `create_docs_card` inputs
- Valid and invalid `update_docs_card` inputs, including empty patches

### Execution and observations

- Live-editor and in-memory creation produce equivalent props
- Updates preserve unrelated props and reject missing or wrong-type targets
- Long multiline Markdown remains intact in the shape and observation
- Insert-menu creation selects the new shape and updates the observation

### UI and rendering

- Card renders title, full scrollable body, and empty state
- Wheel events inside the body do not pan the canvas
- Modal opens from `Edit` button activation, but not from double-clicking the card
- Title/content changes autosave after debounce
- Title and source fields preserve supported Markdown for the scrollable canvas display
- Code blocks, links, and empty/error states are accessible and safe
- Escape and close behavior leave committed edits intact

### Auto-frame layout

- Docs Cards classify as `docs`
- Docs frame title and category order are correct
- Portrait dimensions affect frame packing and multiple Docs Cards lay out without overlap

## Definition of done

A user can insert a Docs Card, paste a long Markdown document, read the complete document by scrolling on the canvas, click Edit to change its title and source, close and reopen it with content preserved, and see the same document through Hermes actions and observations. Existing Note Cards and other card types retain their current behavior.
