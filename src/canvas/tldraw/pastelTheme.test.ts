import { describe, expect, it, vi } from 'vitest'
import { DefaultColorStyle } from 'tldraw'
import {
  HERMES_CANVAS_FONT_FAMILY,
  HERMES_PASTEL_THEME_ID,
  hermesPastelTheme
} from './pastelTheme'

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
      fonts: {
        draw: { fontFamily: "'tldraw_draw', sans-serif" },
        sans: { fontFamily: "'tldraw_sans', sans-serif" }
      },
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
    expect(hermesPastelTheme.fontSize).toBe(12)
    expect(hermesPastelTheme.fonts.draw.fontFamily).toBe(HERMES_CANVAS_FONT_FAMILY)
    expect(hermesPastelTheme.fonts.sans.fontFamily).toBe(HERMES_CANVAS_FONT_FAMILY)

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

  it('uses bright frame-only colors for automatic card groups in both themes', () => {
    expect(hermesPastelTheme.colors.light['light-violet']).toMatchObject({
      frameHeadingStroke: '#7c3aed',
      frameHeadingFill: '#ede9fe',
      frameStroke: '#7c3aed',
      frameFill: '#f5f3ff',
      frameText: '#111827'
    })
    expect(hermesPastelTheme.colors.light.yellow).toMatchObject({
      frameHeadingStroke: '#eab308',
      frameHeadingFill: '#fef3c7',
      frameStroke: '#eab308',
      frameFill: '#fffbeb',
      frameText: '#111827'
    })
    expect(hermesPastelTheme.colors.light.green).toMatchObject({
      frameHeadingStroke: '#16a34a',
      frameHeadingFill: '#dcfce7',
      frameStroke: '#16a34a',
      frameFill: '#f0fdf4',
      frameText: '#111827'
    })
    expect(hermesPastelTheme.colors.light['light-blue']).toMatchObject({
      frameHeadingStroke: '#2563eb',
      frameHeadingFill: '#dbeafe',
      frameStroke: '#2563eb',
      frameFill: '#eff6ff',
      frameText: '#111827'
    })

    expect(hermesPastelTheme.colors.dark['light-violet']).toMatchObject({
      frameHeadingStroke: '#a78bfa',
      frameHeadingFill: '#2e2652',
      frameStroke: '#a78bfa',
      frameFill: '#1e1b2e',
      frameText: '#f8fafc'
    })
    expect(hermesPastelTheme.colors.dark.yellow).toMatchObject({
      frameHeadingStroke: '#facc15',
      frameHeadingFill: '#342b10',
      frameStroke: '#facc15',
      frameFill: '#211d0f',
      frameText: '#f8fafc'
    })
    expect(hermesPastelTheme.colors.dark.green).toMatchObject({
      frameHeadingStroke: '#4ade80',
      frameHeadingFill: '#173622',
      frameStroke: '#4ade80',
      frameFill: '#0f2116',
      frameText: '#f8fafc'
    })
    expect(hermesPastelTheme.colors.dark['light-blue']).toMatchObject({
      frameHeadingStroke: '#60a5fa',
      frameHeadingFill: '#162d4f',
      frameStroke: '#60a5fa',
      frameFill: '#101e33',
      frameText: '#f8fafc'
    })

    expect(hermesPastelTheme.colors.light.yellow).toMatchObject({
      solid: '#fef3c7',
      noteFill: '#fef3c7'
    })
    expect(hermesPastelTheme.colors.dark['light-blue']).toMatchObject({
      solid: '#bfdbfe',
      noteFill: '#bfdbfe'
    })
  })
})
