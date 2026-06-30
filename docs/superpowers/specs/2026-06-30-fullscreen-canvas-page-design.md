# Fullscreen Canvas Page Design

## Context

The app currently opens to a three-column workspace: action simulator, canvas, and inspector. This is useful for development, but the canvas itself is visually constrained. Users need a cleaner page where the Excalidraw canvas fills the viewport and is easier to view.

## Design

Add a route-like view selected by the query string:

```text
?view=canvas
```

The default view remains the existing workspace. The canvas panel header gains a `Fullscreen` link that points to `?view=canvas`.

When `view=canvas`, `App` renders a dedicated fullscreen canvas page:

- A compact top bar with the app title, bridge status, and a `Back` link to `/`.
- A canvas container that fills the remaining viewport.
- The same `CanvasSurface` component, so bridge connection and canvas behavior are unchanged.

## UI Requirements

- Default workspace keeps simulator and inspector.
- Fullscreen view does not render simulator or inspector.
- Canvas fills available browser height in fullscreen mode.
- Controls use existing visual language: dark surfaces, subtle borders, status pill, small action links.
- Mobile and desktop layouts avoid text overlap.

## Tests

- Default render shows workspace and fullscreen link.
- Query string `?view=canvas` renders fullscreen canvas page.
- Fullscreen render hides simulator/inspector-specific text and shows the back link.
