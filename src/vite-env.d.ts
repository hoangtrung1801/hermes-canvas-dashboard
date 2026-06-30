/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CANVAS_GATEWAY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
