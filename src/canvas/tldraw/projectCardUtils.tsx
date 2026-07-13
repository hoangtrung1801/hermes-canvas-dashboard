import {
  DefaultColorStyle,
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  getColorValue,
  resizeBox,
  useEditor,
  type TLResizeInfo,
  type TLShape
} from 'tldraw'
import type { CSSProperties } from 'react'
import { ProjectCardBoard } from './ProjectCardBoard'
import {
  PROJECT_CARD_MIN_HEIGHT,
  PROJECT_CARD_MIN_WIDTH,
  PROJECT_CARD_TYPE,
  createProjectCardProps,
  projectCardMigrations,
  projectCardProps,
  type ProjectCardProps
} from './projectCard.types'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [PROJECT_CARD_TYPE]: ProjectCardProps
  }
}

export type ProjectCardShape = TLShape<typeof PROJECT_CARD_TYPE>

function ProjectCardView({ shape }: { shape: ProjectCardShape }) {
  const editor = useEditor()
  const background = getColorValue(
    editor.getCurrentTheme().colors[editor.getColorMode()],
    shape.props.color,
    'noteFill'
  )
  const style = {
    width: shape.props.w,
    height: shape.props.h,
    backgroundColor: background,
    '--hermes-card-accent': background
  } as CSSProperties

  return (
    <HTMLContainer className="hermes-shape hermes-project-card" style={style}>
      <ProjectCardBoard
        title={shape.props.title}
        tasks={shape.props.tasks}
        onTitleChange={(title) =>
          editor.updateShape({
            id: shape.id,
            type: PROJECT_CARD_TYPE,
            props: { title }
          })
        }
        onTasksChange={(tasks) =>
          editor.updateShape({
            id: shape.id,
            type: PROJECT_CARD_TYPE,
            props: { tasks }
          })
        }
        onInteraction={(event) => editor.markEventAsHandled(event)}
      />
    </HTMLContainer>
  )
}

export class ProjectCardShapeUtil extends ShapeUtil<ProjectCardShape> {
  static override type = PROJECT_CARD_TYPE
  static override migrations = projectCardMigrations
  static override props = { ...projectCardProps, color: DefaultColorStyle }

  override canEdit = () => false
  override canResize = () => true
  override isAspectRatioLocked = () => false

  getDefaultProps() {
    return createProjectCardProps({ title: 'New Project' })
  }

  getGeometry(shape: ProjectCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  getIndicatorPath() {
    return undefined
  }

  override onResize(shape: ProjectCardShape, info: TLResizeInfo<ProjectCardShape>) {
    const { id: _id, type: _type, ...patch } = resizeBox(shape, info, {
      minWidth: PROJECT_CARD_MIN_WIDTH,
      minHeight: PROJECT_CARD_MIN_HEIGHT
    })
    return patch
  }

  component(shape: ProjectCardShape) {
    return <ProjectCardView shape={shape} />
  }
}
