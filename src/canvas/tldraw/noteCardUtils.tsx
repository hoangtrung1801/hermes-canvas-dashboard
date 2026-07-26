import { DefaultColorStyle, HTMLContainer, useEditor, useIsEditing, type TLShape } from 'tldraw'
import { T } from '@tldraw/validate'
import {
  BaseHermesCardUtil,
  cardStyle,
  controlHandlers,
  enterShapeEditMode,
  updateShapeProps
} from './cardChassis'
import {
  DEFAULT_NOTE_CARD_COLOR,
  NOTE_CARD_DEFAULT_HEIGHT,
  NOTE_CARD_DEFAULT_WIDTH,
  NOTE_CARD_TYPE,
  noteCardMigrations,
  type NoteCardProps
} from './noteCard.types'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [NOTE_CARD_TYPE]: NoteCardProps
  }
}

export type NoteCardShape = TLShape<typeof NOTE_CARD_TYPE>

function NoteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h6M7 10h5M7 13h3" />
    </svg>
  )
}

export class NoteCardShapeUtil extends BaseHermesCardUtil<any> {
  static override type = NOTE_CARD_TYPE
  static override migrations = noteCardMigrations
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    tag: T.string,
    content: T.string,
    color: DefaultColorStyle,
    backgroundColor: T.string.optional()
  }

  getDefaultProps(): NoteCardProps {
    return {
      w: NOTE_CARD_DEFAULT_WIDTH,
      h: NOTE_CARD_DEFAULT_HEIGHT,
      title: 'New Note',
      tag: 'Idea',
      content: '',
      color: DEFAULT_NOTE_CARD_COLOR
    }
  }

  component(shape: NoteCardShape) {
    const editor = useEditor()
    const isEditing = useIsEditing(shape.id)
    const handlers = controlHandlers(editor)

    if (isEditing) {
      return (
        <HTMLContainer
          className="hermes-shape hermes-note-card"
          style={cardStyle(editor, shape.props)}
        >
          <div className="hermes-card-header">
            <span className="hermes-card-icon">
              <NoteIcon />
            </span>
            <input
              className="hermes-inline-title-input"
              value={shape.props.title}
              aria-label="Note title"
              onChange={(event) =>
                updateShapeProps(editor, shape, { title: event.currentTarget.value })
              }
              {...handlers}
            />
          </div>
          <input
            className="hermes-note-tag-input"
            value={shape.props.tag}
            aria-label="Note tag"
            placeholder="Tag"
            onChange={(event) =>
              updateShapeProps(editor, shape, { tag: event.currentTarget.value })
            }
            {...handlers}
          />
          <textarea
            className="hermes-note-body-input"
            value={shape.props.content}
            aria-label="Note content"
            placeholder="Write a note…"
            onChange={(event) =>
              updateShapeProps(editor, shape, { content: event.currentTarget.value })
            }
            {...handlers}
          />
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer
        className="hermes-shape hermes-note-card"
        style={cardStyle(editor, shape.props)}
        onDoubleClick={(event) => enterShapeEditMode(editor, shape, event)}
      >
        <div className="hermes-card-header">
          <span className="hermes-card-icon">
            <NoteIcon />
          </span>
          <strong>{shape.props.title}</strong>
        </div>
        {shape.props.tag ? <p className="hermes-card-kicker">{shape.props.tag}</p> : null}
        {shape.props.content ? <p className="hermes-note-body">{shape.props.content}</p> : null}
      </HTMLContainer>
    )
  }
}
