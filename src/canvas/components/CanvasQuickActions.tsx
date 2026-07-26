import {
  DefaultQuickActions,
  DefaultQuickActionsContent,
  TldrawUiMenuItem,
  type TLUiQuickActionsProps
} from 'tldraw'
import { TidyIcon, useCanvasTidy } from './CanvasTidyButton'

export function CanvasQuickActions(props: TLUiQuickActionsProps) {
  const { tidyCanvas, isReady } = useCanvasTidy()

  return (
    <DefaultQuickActions {...props}>
      <DefaultQuickActionsContent />
      <TldrawUiMenuItem
        id="hermes-tidy"
        label="Tidy"
        icon={
          <div className="canvas-quick-action-icon">
            <TidyIcon />
          </div>
        }
        disabled={!isReady}
        onSelect={tidyCanvas}
      />
    </DefaultQuickActions>
  )
}
