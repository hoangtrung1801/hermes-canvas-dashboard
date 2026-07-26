import { DefaultColorStyle, createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from '@tldraw/tlschema'
import { T } from '@tldraw/validate'
import {
  docsCardMigrations,
} from './docsCard.types'
import {
  linkCardMigrations,
  todoBlockMigrations
} from './customShape.types'
import { projectCardMigrations, projectCardProps } from './projectCard.types'
import { noteCardMigrations } from './noteCard.types'

const taskValidator = T.object({
  id: T.string,
  text: T.string,
  done: T.boolean
})

const sizeAndTitleProps = {
  w: T.number,
  h: T.number,
  title: T.string
}

export function createHermesTldrawSchema() {
  return createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      todo_block: {
        migrations: todoBlockMigrations,
        props: {
          ...sizeAndTitleProps,
          tasks: T.arrayOf(taskValidator),
          color: DefaultColorStyle,
          backgroundColor: T.string.optional()
        }
      },
      link_card: {
        migrations: linkCardMigrations,
        props: {
          ...sizeAndTitleProps,
          url: T.string,
          description: T.string,
          imageUrl: T.string,
          color: DefaultColorStyle,
          backgroundColor: T.string.optional()
        }
      },
      project_card: {
        migrations: projectCardMigrations,
        props: projectCardProps
      },
      docs_card: {
        migrations: docsCardMigrations,
        props: {
          w: T.number,
          h: T.number,
          title: T.string,
          content: T.string
        }
      },
      note_card: {
        migrations: noteCardMigrations,
        props: {
          w: T.number,
          h: T.number,
          title: T.string,
          tag: T.string,
          content: T.string,
          color: DefaultColorStyle,
          backgroundColor: T.string.optional()
        }
      }
    },
    bindings: defaultBindingSchemas
  })
}
