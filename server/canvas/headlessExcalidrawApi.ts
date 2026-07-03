import type {
  ExcalidrawApiLike,
  ExcalidrawElementLike
} from '../../src/canvas/adapters/ExcalidrawAdapter'

type HeadlessAppState = ReturnType<ExcalidrawApiLike['getAppState']>

const defaultAppState: HeadlessAppState = {
  scrollX: 0,
  scrollY: 0,
  selectedElementIds: {},
  width: 1200,
  height: 800
}

export class HeadlessExcalidrawApi implements ExcalidrawApiLike {
  private elements: ExcalidrawElementLike[]
  private appState: HeadlessAppState

  constructor(
    elements: readonly ExcalidrawElementLike[],
    appState: HeadlessAppState = defaultAppState
  ) {
    this.elements = elements.map((element) => ({ ...element }))
    this.appState = {
      ...defaultAppState,
      ...appState,
      selectedElementIds: { ...(appState.selectedElementIds ?? {}) }
    }
  }

  updateScene(scene: {
    elements?: readonly ExcalidrawElementLike[]
    appState?: Record<string, unknown> | null
  }): void {
    if (scene.elements) {
      this.elements = scene.elements.map((element) => ({ ...element }))
    }

    if (scene.appState) {
      this.appState = {
        ...this.appState,
        ...scene.appState
      }
    }
  }

  getSceneElements(): readonly ExcalidrawElementLike[] {
    return this.elements.map((element) => ({ ...element }))
  }

  getAppState(): HeadlessAppState {
    return {
      ...this.appState,
      selectedElementIds: { ...(this.appState.selectedElementIds ?? {}) }
    }
  }

  scrollToContent(): void {
    this.updateScene({ appState: { scrollX: 0, scrollY: 0 } })
  }
}
