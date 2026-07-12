import { describe, expect, it, vi } from 'vitest'
import { DefaultColorStyle } from 'tldraw'
import { HERMES_PASTEL_THEME_ID, hermesPastelTheme } from './pastelTheme'

const colorNames = vi.hoisted(() => [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
])

vi.mock('tldraw', () => {
  const createDefaultThemeColors = () => {
    const paletteColor = { noteFill: '#ffffff' }
    return {
      text: '#111827',
      background: '#ffffff',
      negativeSpace: '#ffffff',
      solid: '#ffffff',
      cursor: '#111827',
      noteBorder: '#e5e7eb',
      snap: '#3b82f6',
      selectionStroke: '#3b82f6',
      selectionFill: '#ffffff',
      brushFill: '#bfdbfe',
      brushStroke: '#3b82f6',
      selectedContrast: '#ffffff',
      laser: '#ef4444',
      ...Object.fromEntries(colorNames.map((color) => [color, paletteColor]))
    }
  }

  return {
    DefaultColorStyle: { values: colorNames },
    DEFAULT_THEME: {
      id: 'default',
      fontSize: 16,
      lineHeight: 1.35,
      strokeWidth: 2,
      fonts: {},
      colors: {
        light: createDefaultThemeColors(),
        dark: createDefaultThemeColors()
      }
    }
  }
})

describe('hermesPastelTheme', () => {
  it('registers every built-in tldraw color with pastel values', () => {
    expect(hermesPastelTheme.id).toBe(HERMES_PASTEL_THEME_ID)

    for (const color of DefaultColorStyle.values) {
      expect(hermesPastelTheme.colors.light).toHaveProperty(color)
      expect(hermesPastelTheme.colors.dark).toHaveProperty(color)
    }

    expect(hermesPastelTheme.colors.light.yellow).toMatchObject({
      solid: '#fef3c7',
      noteFill: '#fef3c7'
    })
    expect(hermesPastelTheme.colors.light.black).toMatchObject({
      solid: '#111827',
      noteText: '#111827'
    })
    expect(hermesPastelTheme.colors.light['light-blue']).toMatchObject({
      solid: '#dbeafe',
      noteFill: '#dbeafe'
    })
    expect(hermesPastelTheme.colors.light['light-green']).toMatchObject({
      solid: '#dcfce7',
      noteFill: '#dcfce7'
    })
  })
})
