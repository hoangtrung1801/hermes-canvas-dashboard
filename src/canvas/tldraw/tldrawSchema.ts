import { DefaultColorStyle, createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from '@tldraw/tlschema'
import { T } from '@tldraw/validate'
import {
  linkCardMigrations,
  todoBlockMigrations
} from './customShape.types'
import { projectCardMigrations, projectCardProps } from './projectCard.types'

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
      }
    },
    bindings: defaultBindingSchemas
  })
}
