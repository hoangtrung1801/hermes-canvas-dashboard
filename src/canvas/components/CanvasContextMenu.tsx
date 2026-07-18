import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  useEditor,
  useToasts,
  useValue,
  type TLUiContextMenuProps
} from 'tldraw'

export function CanvasContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const { addToast } = useToasts()
  const hasSingleSelectedShape = useValue(
    'has single selected shape for copy id',
    () => editor.getSelectedShapeIds().length === 1,
    [editor]
  )

  const showCopyError = () => {
    addToast({
      title: 'Could not copy component ID',
      description: 'Clipboard access was denied.',
      severity: 'error',
      icon: 'clipboard-copy'
    })
  }

  const copySelectedShapeId = async () => {
    const shape = editor.getOnlySelectedShape()
    const clipboard = editor.getContainerWindow().navigator.clipboard

    if (!shape || !clipboard?.writeText) {
      showCopyError()
      return
    }

    try {
      await clipboard.writeText(shape.id)
      addToast({
        title: 'Component ID copied',
        description: shape.id,
        severity: 'success',
        icon: 'clipboard-copied'
      })
    } catch {
      showCopyError()
    }
  }

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      {hasSingleSelectedShape && (
        <TldrawUiMenuGroup id="hermes-component-actions">
          <TldrawUiMenuItem
            id="copy-component-id"
            label="Copy ID"
            icon="clipboard-copy"
            onSelect={copySelectedShapeId}
          />
        </TldrawUiMenuGroup>
      )}
    </DefaultContextMenu>
  )
}
