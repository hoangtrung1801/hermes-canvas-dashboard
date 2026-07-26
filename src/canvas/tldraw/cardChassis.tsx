import {
  Rectangle2d,
  ShapeUtil,
  getColorValue,
  resizeBox,
  useEditor,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { HERMES_CARD_MIN_HEIGHT, HERMES_CARD_MIN_WIDTH } from './customShape.types'

/**
 * The shared card chassis.
 *
 * Extracted from customShapeUtils.tsx so that sibling shape modules
 * (noteCardUtils, docsCardUtils, projectCardUtils) can build on it without
 * importing from the module that also aggregates them — that cycle leaves
 * BaseHermesCardUtil undefined at class-evaluation time.
 */

/** Any Hermes card shape. Deliberately loose: the chassis only reads w/h. */
export type AnyCardShape = TLShape & { props: Record<string, any> }

export abstract class BaseHermesCardUtil<Shape extends AnyCardShape> extends ShapeUtil<Shape> {
  override canEdit = () => true
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getGeometry(shape: Shape) {
    const props = shape.props as Record<string, unknown>
    return new Rectangle2d({
      width: typeof props.w === 'number' ? props.w : 240,
      height: typeof props.h === 'number' ? props.h : 140,
      isFilled: true
    })
  }

  getIndicatorPath() {
    return undefined
  }

  override onResize(shape: Shape, info: TLResizeInfo<Shape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape as any, info as any, {
      minWidth: HERMES_CARD_MIN_WIDTH,
      minHeight: HERMES_CARD_MIN_HEIGHT
    })

    return patch
  }
}

export function markCanvasEventHandled(
  editor: ReturnType<typeof useEditor>,
  event: PointerEvent<HTMLElement>
) {
  editor.markEventAsHandled(event)
}

export function enterShapeEditMode<Shape extends AnyCardShape>(
  editor: ReturnType<typeof useEditor>,
  shape: Shape,
  event: MouseEvent<HTMLElement>
) {
  editor.setEditingShape(shape.id)
  editor.markEventAsHandled(event)
}

export function controlHandlers(editor: ReturnType<typeof useEditor>) {
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => markCanvasEventHandled(editor, event),
    onPointerUp: (event: PointerEvent<HTMLElement>) => markCanvasEventHandled(editor, event)
  }
}

export function updateShapeProps<Shape extends AnyCardShape>(
  editor: ReturnType<typeof useEditor>,
  shape: Shape,
  props: Partial<Shape['props']>
) {
  editor.updateShape({
    id: shape.id,
    type: shape.type,
    props
  } as any)
}

export function cardStyle(
  editor: ReturnType<typeof useEditor>,
  props: { w: number; h: number; color?: string; backgroundColor?: string }
): CSSProperties {
  const colors = editor.getCurrentTheme().colors[editor.getColorMode()]
  const accent = props.color
    ? getColorValue(colors, props.color, 'noteFill')
    : props.backgroundColor

  // Accent only. The card background and readable ink are derived from it in
  // CSS, so this must never set backgroundColor directly.
  return {
    width: props.w,
    height: props.h,
    ...(accent ? { '--hc-accent': accent } : {})
  } as CSSProperties
}
