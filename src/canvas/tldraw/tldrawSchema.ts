import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas } from '@tldraw/tlschema'
import { T } from '@tldraw/validate'

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
        props: {
          ...sizeAndTitleProps,
          tasks: T.arrayOf(taskValidator)
        }
      },
      task_card: {
        props: {
          ...sizeAndTitleProps,
          body: T.string,
          status: T.string,
          priority: T.string
        }
      },
      link_card: {
        props: {
          ...sizeAndTitleProps,
          url: T.string,
          description: T.string
        }
      }
    },
    bindings: defaultBindingSchemas
  })
}
