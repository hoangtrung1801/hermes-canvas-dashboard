import '@testing-library/jest-dom/vitest'

if (!globalThis.PointerEvent) {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }

  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent
  })
}
