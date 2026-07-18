/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CANVAS_GATEWAY_URL?: string
  readonly VITE_CANVAS_STATE_URL?: string
  readonly VITE_CHAT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
