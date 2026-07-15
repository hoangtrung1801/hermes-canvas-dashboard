# Bright Frame Colors Design

**Status:** Approved design
**Date:** July 15, 2026
**Scope:** Increase the visual brightness of the four auto-frame category colors without changing cards or notes

## Context

Hermes Canvas uses a custom tldraw pastel theme. The current theme assigns one pastel value to every visual role for a color, including card surfaces, note fills, frame borders, frame headings, and frame interiors. As a result, generated Projects, Todos, Notes, and Links frames have low-contrast boundaries even though their category colors differ.

## Goal

Make generated card-group frames brighter and easier to scan by using vivid category-colored borders with soft tinted surfaces. Preserve the existing card, note, highlight, solid, and general fill colors.

## Chosen Treatment

Use vivid frame and heading strokes, a slightly stronger tinted heading, and a near-white tinted frame interior. This provides a clear category boundary without placing card content on a fully saturated background.

Fully saturated frame surfaces were rejected because they would compete with card content and reduce text readability. Bright headings with unchanged frame borders were rejected because the group boundary would remain too faint.

## Palette

### Light mode

| Category | tldraw color | Stroke | Heading fill | Frame fill | Text |
|---|---|---:|---:|---:|---:|
| Projects | `light-violet` | `#7C3AED` | `#EDE9FE` | `#F5F3FF` | `#111827` |
| Todos | `yellow` | `#EAB308` | `#FEF3C7` | `#FFFBEB` | `#111827` |
| Notes | `green` | `#16A34A` | `#DCFCE7` | `#F0FDF4` | `#111827` |
| Links | `light-blue` | `#2563EB` | `#DBEAFE` | `#EFF6FF` | `#111827` |

### Dark mode

| Category | tldraw color | Stroke | Heading fill | Frame fill | Text |
|---|---|---:|---:|---:|---:|
| Projects | `light-violet` | `#A78BFA` | `#2E2652` | `#1E1B2E` | `#F8FAFC` |
| Todos | `yellow` | `#FACC15` | `#342B10` | `#211D0F` | `#F8FAFC` |
| Notes | `green` | `#4ADE80` | `#173622` | `#0F2116` | `#F8FAFC` |
| Links | `light-blue` | `#60A5FA` | `#162D4F` | `#101E33` | `#F8FAFC` |

Both `frameStroke` and `frameHeadingStroke` use the category stroke value.

## Architecture

The change remains isolated to `pastelTheme.ts`. Theme construction will continue creating all existing pastel color roles, then apply a small frame-role override for the four category color styles in light and dark palettes.

No auto-frame shape props, metadata, layout logic, migrations, or runtime reconciliation behavior changes. Existing frames update through the active theme without rewriting persisted shape records.

Any manually created frame using one of the same four tldraw color styles receives the same brighter frame treatment. Manual frames using other color styles remain unchanged. Cards and notes using these four styles retain their current `solid`, `fill`, `noteFill`, and related values.

## Testing

Theme tests will assert the exact five frame-role values for all four category colors in both light and dark mode. Regression assertions will prove that representative non-frame values, including `solid` and `noteFill`, retain the existing pastel values.

The complete type check, build, and test suite must pass. Visual browser verification should confirm that category borders are vivid, interiors remain soft, headings remain readable, and card colors do not change when a browser target is available.

## Success Criteria

Projects, Todos, Notes, and Links frames have clearly visible vivid borders and headings in light and dark mode while their interiors remain soft. Cards and notes retain their existing pastel colors, and no stored canvas shape requires migration.
