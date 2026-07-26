import { DefaultStylePanel, useEditor, useValue, type TLUiStylePanelProps } from 'tldraw'

/**
 * Shape types and tool ids whose appearance the style panel actually controls.
 * Hermes cards are absent deliberately: their colour comes from the card accent,
 * not from this panel.
 */
const NATIVE_STYLED = new Set(['draw', 'text', 'arrow', 'line', 'geo', 'highlight'])

export function CanvasStylePanel(props: TLUiStylePanelProps) {
  const editor = useEditor()

  const shouldShow = useValue(
    'style panel applies to selection',
    () => {
      if (NATIVE_STYLED.has(editor.getCurrentToolId())) return true
      return editor.getSelectedShapes().some((shape) => NATIVE_STYLED.has(shape.type))
    },
    [editor]
  )

  if (!shouldShow) return null

  return <DefaultStylePanel {...props} />
}
