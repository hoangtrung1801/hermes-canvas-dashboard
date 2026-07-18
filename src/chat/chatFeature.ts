type ChatFeatureEnv = {
  VITE_CHAT_ENABLED?: string
}

const disabledValues = new Set(['0', 'false', 'no', 'off'])

export function isChatEnabled(env: ChatFeatureEnv = import.meta.env) {
  const configuredValue = env.VITE_CHAT_ENABLED?.trim().toLowerCase()

  return !configuredValue || !disabledValues.has(configuredValue)
}
