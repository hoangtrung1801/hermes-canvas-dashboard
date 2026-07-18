import { describe, expect, it } from 'vitest'
import { isChatEnabled } from './chatFeature'

describe('isChatEnabled', () => {
  it('keeps the chatbot enabled when the flag is absent', () => {
    expect(isChatEnabled({})).toBe(true)
  })

  it.each(['false', '0', 'off', 'no'])('disables the chatbot for %s', (value) => {
    expect(isChatEnabled({ VITE_CHAT_ENABLED: value })).toBe(false)
  })

  it.each(['true', '1', 'on', 'yes'])('enables the chatbot for %s', (value) => {
    expect(isChatEnabled({ VITE_CHAT_ENABLED: value })).toBe(true)
  })
})
