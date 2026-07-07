# Native Note Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hermes `create_note_card` action and insert-menu option that create native tldraw `note` shapes with bold title/tag text and normal content.

**Architecture:** The Hermes API will accept separate `title`, `tag`, and `content` fields, then convert them into standard tldraw note props. A small helper will own rich-text and note-prop construction; the existing executor and bridge will create the resulting native `note` shape through the same shape creation path used elsewhere.

**Tech Stack:** TypeScript, React, Vite, Vitest, tldraw, zod.

---

## File Structure

- Modify `src/canvas/actions/canvasAction.types.ts`: add the typed `CreateNoteCardAction`.
- Modify `src/canvas/actions/canvasAction.schema.ts`: validate `create_note_card`, note color, and note size values.
- Modify `src/canvas/actions/canvasAction.schema.test.ts`: cover valid note-card actions and required-field/style validation failures.
- Create `src/canvas/tldraw/nativeNoteCard.ts`: build tldraw `note` props and rich text from Hermes note-card input.
- Create `src/canvas/tldraw/nativeNoteCard.test.ts`: unit test bold title/tag rich text and content line splitting.
- Modify `src/canvas/tldraw/tldrawActionExecutor.ts`: route `create_note_card` to `type: 'note'` shape creation.
- Modify `src/canvas/tldraw/tldrawActionExecutor.test.ts`: cover headless native note creation and observation output.
- Modify `src/canvas/components/CanvasInsertMenu.tsx`: add `Note Card` to the floating insert menu.
- Modify `src/canvas/components/CanvasSurface.test.tsx`: assert the insert menu creates and selects a native `note`.
- Modify `CANVAS_API.md`: document the new `create_note_card` action.

---

### Task 1: Add Action Types And Schema Validation

**Files:**
- Modify: `src/canvas/actions/canvasAction.types.ts`
- Modify: `src/canvas/actions/canvasAction.schema.ts`
- Test: `src/canvas/actions/canvasAction.schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add this test to `src/canvas/actions/canvasAction.schema.test.ts`:

```ts
it('accepts native note card helper actions', () => {
  expect(
    canvasActionSchema.parse({
      type: 'create_note_card',
      id: 'shape:note_1',
      x: 180,
      y: 220,
      title: 'Offline Sync',
      tag: 'Idea',
      content: 'Queue writes locally\nFlush when online',
      color: 'yellow',
      size: 'm'
    })
  ).toMatchObject({
    type: 'create_note_card',
    title: 'Offline Sync',
    tag: 'Idea',
    content: 'Queue writes locally\nFlush when online',
    color: 'yellow',
    size: 'm'
  })
})

it('rejects invalid note card helper actions', () => {
  expect(() =>
    canvasActionSchema.parse({
      type: 'create_note_card',
      x: 0,
      y: 0,
      title: '',
      tag: 'Idea'
    })
  ).toThrow()

  expect(() =>
    canvasActionSchema.parse({
      type: 'create_note_card',
      x: 0,
      y: 0,
      title: 'Draft',
      tag: ''
    })
  ).toThrow()

  expect(() =>
    canvasActionSchema.parse({
      type: 'create_note_card',
      x: 0,
      y: 0,
      title: 'Draft',
      tag: 'Idea',
      color: 'magenta'
    })
  ).toThrow()

  expect(() =>
    canvasActionSchema.parse({
      type: 'create_note_card',
      x: 0,
      y: 0,
      title: 'Draft',
      tag: 'Idea',
      size: 'xxl'
    })
  ).toThrow()
})
```

- [ ] **Step 2: Run schema tests to verify they fail**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: FAIL because `create_note_card` is not yet part of the zod union.

- [ ] **Step 3: Add the action type**

In `src/canvas/actions/canvasAction.types.ts`, add this exported type after `CreateLinkCardAction`:

```ts
export type CreateNoteCardAction = {
  type: 'create_note_card'
  id?: string
  x: number
  y: number
  title: string
  tag: string
  content?: string
  color?: string
  size?: 's' | 'm' | 'l' | 'xl'
}
```

Then add `CreateNoteCardAction` to the `CanvasAction` union:

```ts
  | CreateTaskCardAction
  | CreateLinkCardAction
  | CreateNoteCardAction
```

- [ ] **Step 4: Add zod validation**

In `src/canvas/actions/canvasAction.schema.ts`, add these constants near `backgroundColor`:

```ts
const tldrawDefaultColor = z.enum([
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
])
const tldrawNoteSize = z.enum(['s', 'm', 'l', 'xl'])
```

Add this union member after `create_link_card`:

```ts
  z.object({
    type: z.literal('create_note_card'),
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    tag: z.string().min(1),
    content: z.string().optional(),
    color: tldrawDefaultColor.optional(),
    size: tldrawNoteSize.optional(),
    ...position
  })
```

- [ ] **Step 5: Run schema tests to verify they pass**

Run: `npm test -- src/canvas/actions/canvasAction.schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/actions/canvasAction.types.ts src/canvas/actions/canvasAction.schema.ts src/canvas/actions/canvasAction.schema.test.ts
git commit -m "feat: add note card action schema"
```

---

### Task 2: Add Native Note Prop Builder

**Files:**
- Create: `src/canvas/tldraw/nativeNoteCard.ts`
- Test: `src/canvas/tldraw/nativeNoteCard.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/canvas/tldraw/nativeNoteCard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createNoteCardProps } from './nativeNoteCard'

describe('native note card props', () => {
  it('creates default tldraw note props with bold title and tag paragraphs', () => {
    const props = createNoteCardProps({
      title: 'Offline Sync',
      tag: 'Idea',
      content: 'Queue writes locally'
    })

    expect(props).toMatchObject({
      color: 'yellow',
      labelColor: 'black',
      size: 'm',
      font: 'draw',
      fontSizeAdjustment: null,
      align: 'start',
      verticalAlign: 'start',
      growY: 0,
      url: '',
      scale: 1,
      textLastEditedBy: null
    })
    expect(props.richText).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Offline Sync', marks: [{ type: 'bold' }] }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Idea', marks: [{ type: 'bold' }] }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Queue writes locally' }]
        }
      ]
    })
  })

  it('preserves content line breaks as normal rich text paragraphs', () => {
    expect(
      createNoteCardProps({
        title: 'Research',
        tag: 'Note',
        content: 'Line one\n\nLine three',
        color: 'light-blue',
        size: 'l'
      })
    ).toMatchObject({
      color: 'light-blue',
      size: 'l',
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Research', marks: [{ type: 'bold' }] }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Note', marks: [{ type: 'bold' }] }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line one' }]
          },
          {
            type: 'paragraph'
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line three' }]
          }
        ]
      }
    })
  })

  it('omits content paragraphs when content is empty', () => {
    expect(
      createNoteCardProps({
        title: 'Quick capture',
        tag: 'Idea',
        content: ''
      }).richText.content
    ).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run: `npm test -- src/canvas/tldraw/nativeNoteCard.test.ts`

Expected: FAIL because `nativeNoteCard.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/canvas/tldraw/nativeNoteCard.ts`:

```ts
import type { TLDefaultColorStyle, TLDefaultSizeStyle, TLNoteShapeProps, TLRichText } from 'tldraw'

type NoteCardInput = {
  title: string
  tag: string
  content?: string
  color?: TLDefaultColorStyle
  size?: TLDefaultSizeStyle
}

function boldParagraph(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text, marks: [{ type: 'bold' }] }]
  }
}

function contentParagraph(text: string) {
  if (!text) return { type: 'paragraph' }
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }]
  }
}

export function createNoteCardRichText(input: Pick<NoteCardInput, 'title' | 'tag' | 'content'>): TLRichText {
  const contentLines = input.content ? input.content.split('\n') : []

  return {
    type: 'doc',
    content: [
      boldParagraph(input.title),
      boldParagraph(input.tag),
      ...contentLines.map(contentParagraph)
    ]
  }
}

export function createNoteCardProps(input: NoteCardInput): TLNoteShapeProps {
  return {
    color: input.color ?? 'yellow',
    labelColor: 'black',
    size: input.size ?? 'm',
    font: 'draw',
    fontSizeAdjustment: null,
    align: 'start',
    verticalAlign: 'start',
    growY: 0,
    url: '',
    richText: createNoteCardRichText(input),
    scale: 1,
    textLastEditedBy: null
  }
}
```

- [ ] **Step 4: Run helper tests to verify they pass**

Run: `npm test -- src/canvas/tldraw/nativeNoteCard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/tldraw/nativeNoteCard.ts src/canvas/tldraw/nativeNoteCard.test.ts
git commit -m "feat: build native note card props"
```

---

### Task 3: Route create_note_card Through The Executor

**Files:**
- Modify: `src/canvas/tldraw/tldrawActionExecutor.ts`
- Test: `src/canvas/tldraw/tldrawActionExecutor.test.ts`
- Test: `src/canvas/components/CanvasSurface.test.tsx`

- [ ] **Step 1: Write failing executor tests**

Add this test to `src/canvas/tldraw/tldrawActionExecutor.test.ts`:

```ts
it('creates native tldraw note cards with formatted rich text', () => {
  const target = createMemoryTldrawTarget('canvas_001')

  expect(
    executeTldrawAction(target, {
      type: 'create_note_card',
      id: 'shape:note_1',
      title: 'Offline Sync',
      tag: 'Idea',
      content: 'Queue writes locally\nFlush when online',
      color: 'light-blue',
      size: 'l',
      x: 240,
      y: 260
    })
  ).toEqual({ actionType: 'create_note_card', createdShapeIds: ['shape:note_1'] })

  expect(readTldrawObservation(target)).toMatchObject({
    canvasId: 'canvas_001',
    shapes: [
      {
        id: 'shape:note_1',
        type: 'note',
        x: 240,
        y: 260,
        props: {
          color: 'light-blue',
          size: 'l',
          richText: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Offline Sync', marks: [{ type: 'bold' }] }]
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Idea', marks: [{ type: 'bold' }] }]
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Queue writes locally' }]
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Flush when online' }]
              }
            ]
          }
        }
      }
    ]
  })
})
```

In `src/canvas/components/CanvasSurface.test.tsx`, extend the mounted-editor action test by adding this action after the existing `create_task_card` action:

```ts
{
  type: 'create_note_card',
  id: 'shape:note_1',
  title: 'Captured Idea',
  tag: 'Idea',
  content: 'Use native notes',
  x: 180,
  y: 240
}
```

Then extend the observation assertion with:

```ts
expect.objectContaining({
  id: 'shape:note_1',
  type: 'note',
  props: expect.objectContaining({
    richText: expect.objectContaining({ type: 'doc' })
  })
})
```

- [ ] **Step 2: Run executor-related tests to verify they fail**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/components/CanvasSurface.test.tsx`

Expected: FAIL because `executeTldrawAction` does not handle `create_note_card`.

- [ ] **Step 3: Implement executor routing**

In `src/canvas/tldraw/tldrawActionExecutor.ts`, add this import:

```ts
import { createNoteCardProps } from './nativeNoteCard'
```

Add this switch case after `create_link_card`:

```ts
    case 'create_note_card':
      return createShape(target, {
        id: action.id ?? nextShapeId(target, 'note'),
        type: 'note',
        x: action.x,
        y: action.y,
        props: createNoteCardProps(action as any),
        meta: { source: 'hermes' },
        actionType: action.type
      })
```

- [ ] **Step 4: Run executor-related tests to verify they pass**

Run: `npm test -- src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/components/CanvasSurface.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/tldraw/tldrawActionExecutor.ts src/canvas/tldraw/tldrawActionExecutor.test.ts src/canvas/components/CanvasSurface.test.tsx
git commit -m "feat: create native note cards through executor"
```

---

### Task 4: Add Note Card To The Insert Menu

**Files:**
- Modify: `src/canvas/components/CanvasInsertMenu.tsx`
- Test: `src/canvas/components/CanvasSurface.test.tsx`

- [ ] **Step 1: Write failing insert-menu tests**

In `src/canvas/components/CanvasSurface.test.tsx`, update the menu option test to assert the fourth option:

```ts
expect(screen.getByRole('menuitem', { name: /Note Card/ })).toBeInTheDocument()
```

Add this test:

```ts
it('inserts a native note card from the floating canvas menu and selects it', async () => {
  render(<App />)

  const insertButton = await screen.findByRole('button', { name: 'Insert component' })
  act(() => {
    insertButton.click()
  })

  act(() => {
    screen.getByRole('menuitem', { name: /Note Card/ }).click()
  })

  await waitFor(() => {
    expect(useBridgeStore.getState().lastObservation?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'note',
          props: expect.objectContaining({
            richText: expect.objectContaining({ type: 'doc' })
          })
        })
      ])
    )
  })

  expect(tldrawMock.editor.getSelectedShapeIds()).toHaveLength(1)
})
```

- [ ] **Step 2: Run insert-menu tests to verify they fail**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx`

Expected: FAIL because `Note Card` is not in `CanvasInsertMenu`.

- [ ] **Step 3: Implement the menu option**

In `src/canvas/components/CanvasInsertMenu.tsx`, change the union:

```ts
type ComponentKind = 'todo' | 'task' | 'link' | 'note'
```

Change the icon type:

```ts
  icon: 'todo' | 'task' | 'link' | 'note'
```

Add the option:

```ts
  { kind: 'note', label: 'Note Card', icon: 'note' }
```

Update `buildCreateAction` by adding this case before the link fallback:

```ts
  if (kind === 'note') {
    return {
      type: 'create_note_card',
      id,
      title: 'New Note',
      tag: 'Idea',
      content: '',
      x,
      y
    }
  }
```

Update `ComponentIcon` with this branch before the link icon return:

```tsx
  if (icon === 'note') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4" y="3" width="12" height="14" rx="2" />
        <path d="M7 7h6M7 10h5M7 13h3" />
      </svg>
    )
  }
```

- [ ] **Step 4: Run insert-menu tests to verify they pass**

Run: `npm test -- src/canvas/components/CanvasSurface.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/components/CanvasInsertMenu.tsx src/canvas/components/CanvasSurface.test.tsx
git commit -m "feat: add note card insert option"
```

---

### Task 5: Document The Bridge API

**Files:**
- Modify: `CANVAS_API.md`
- Optional Test: manual documentation inspection with `rg`

- [ ] **Step 1: Add API documentation**

In `CANVAS_API.md`, add this section after `create_link_card`:

````markdown
### create_note_card

Creates a native tldraw sticky note. Hermes sends separate `title`, `tag`, and `content` fields; the bridge converts them into the note shape's rich text. The title and tag become bold paragraphs, and content remains normal text.

```json
{
  "type": "create_note_card",
  "id": "shape:idea_capture",
  "title": "Offline Sync",
  "tag": "Idea",
  "content": "Queue writes locally\nFlush when online",
  "color": "yellow",
  "size": "m",
  "x": 140,
  "y": 220
}
```

The created shape appears in observations as `type: "note"` with standard tldraw `props.richText`.
````

- [ ] **Step 2: Verify docs mention the new action**

Run: `rg -n "create_note_card|native tldraw sticky note|props.richText" CANVAS_API.md`

Expected: output includes the new `create_note_card` heading, example, and observation note.

- [ ] **Step 3: Commit**

```bash
git add CANVAS_API.md
git commit -m "docs: document note card action"
```

---

### Task 6: Full Verification

**Files:**
- Verify: full repository test and typecheck commands

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS for all Vitest suites.

- [ ] **Step 2: Run TypeScript type checking**

Run: `npm run lint:types`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Inspect final git status**

Run: `git status --short`

Expected: no uncommitted implementation changes. If package manager metadata or unrelated local changes appear, do not revert them; report them.

---

## Self-Review

- Spec coverage: The plan covers the typed Hermes action, native tldraw `note` output, bold title/tag rich text, content line breaks, insert-menu support, bridge observations, validation, API docs, and full verification.
- Placeholder scan: No task uses open-ended placeholders; each code-changing step includes concrete snippets and exact commands.
- Type consistency: The action name is consistently `create_note_card`; UI kind is `note`; created shape type is native `note`; note props are built by `createNoteCardProps`.
