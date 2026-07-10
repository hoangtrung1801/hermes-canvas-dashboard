# Default Fullscreen Canvas Debug Mode Design

## Goal

When a user opens the application without query parameters, the app should enter a canvas-only experience that fills the browser viewport and hides the topbar. When the URL includes `debug=true`, the app should show the existing action/debug dashboard with the topbar, Action Simulator, canvas panel, and Inspector.

## Behavior

- `/` renders the canvas-only page.
- `/?debug=true` renders the existing action/debug dashboard.
- `/?view=canvas` continues to render the canvas-only page for compatibility with existing links or docs.
- Canvas-only mode does not render the fullscreen topbar, bridge status header, Back link, Action Simulator, or Inspector.
- Debug mode keeps the existing bridge status topbar and action tooling.

## Architecture

The change stays inside `src/App.tsx`. A small query-string helper will derive whether the app is in debug mode from `window.location.search`. The top-level `App` render branch will use that derived mode instead of making `?view=canvas` the only fullscreen trigger.

The existing dashboard components remain unchanged. The existing fullscreen canvas CSS classes can be reused for the page shell and canvas container, with the topbar markup removed from the canvas-only branch.

## Testing

Update `src/App.test.tsx` to cover the new default and debug query behavior:

- The default route renders canvas-only mode and hides the topbar/action debug UI.
- `?debug=true` renders the action/debug dashboard.
- `?view=canvas` still renders canvas-only mode for compatibility.

Run the targeted App test after adding failing tests, then implement the smallest code change required to pass.
