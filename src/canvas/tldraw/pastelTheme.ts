import {
  DEFAULT_THEME,
  type TLDefaultColor,
  type TLDefaultColorStyle,
  type TLTheme,
} from "tldraw";

declare module "@tldraw/tlschema" {
  interface TLThemes {
    "hermes-pastel": TLTheme;
  }
}

export const HERMES_PASTEL_THEME_ID = "hermes-pastel" as const;

const lightPastels = {
  black: "#111827",
  grey: "#e5e7eb",
  "light-violet": "#ede9fe",
  violet: "#ddd6fe",
  blue: "#bfdbfe",
  "light-blue": "#dbeafe",
  yellow: "#fef3c7",
  orange: "#fed7aa",
  green: "#bbf7d0",
  "light-green": "#dcfce7",
  "light-red": "#fee2e2",
  red: "#fecaca",
  white: "#ffffff",
} satisfies Record<TLDefaultColorStyle, string>;

const darkPastels = {
  black: "#f8fafc",
  grey: "#6b7280",
  "light-violet": "#c4b5fd",
  violet: "#a78bfa",
  blue: "#93c5fd",
  "light-blue": "#bfdbfe",
  yellow: "#fde68a",
  orange: "#fdba74",
  green: "#86efac",
  "light-green": "#bbf7d0",
  "light-red": "#fca5a5",
  red: "#f87171",
  white: "#f9fafb",
} satisfies Record<TLDefaultColorStyle, string>;

function pastelColor(
  base: TLDefaultColor,
  value: string,
  text = "#111827",
): TLDefaultColor {
  return {
    ...base,
    solid: value,
    semi: value,
    pattern: value,
    fill: value,
    linedFill: value,
    frameHeadingStroke: value,
    frameHeadingFill: value,
    frameStroke: value,
    frameFill: value,
    frameText: text,
    noteFill: value,
    noteText: text,
    highlightSrgb: value,
    highlightP3: value,
  };
}

function pastelPalette(
  colors: TLTheme["colors"]["light"],
  palette: Record<TLDefaultColorStyle, string>,
  text = "#111827",
): TLTheme["colors"]["light"] {
  return {
    ...colors,
    black: pastelColor(colors.black, palette.black, text),
    grey: pastelColor(colors.grey, palette.grey, text),
    "light-violet": pastelColor(
      colors["light-violet"],
      palette["light-violet"],
      text,
    ),
    violet: pastelColor(colors.violet, palette.violet, text),
    blue: pastelColor(colors.blue, palette.blue, text),
    "light-blue": pastelColor(
      colors["light-blue"],
      palette["light-blue"],
      text,
    ),
    yellow: pastelColor(colors.yellow, palette.yellow, text),
    orange: pastelColor(colors.orange, palette.orange, text),
    green: pastelColor(colors.green, palette.green, text),
    "light-green": pastelColor(
      colors["light-green"],
      palette["light-green"],
      text,
    ),
    "light-red": pastelColor(colors["light-red"], palette["light-red"], text),
    red: pastelColor(colors.red, palette.red, text),
    white: pastelColor(colors.white, palette.white, text),
  };
}

export const hermesPastelTheme: TLTheme = {
  ...DEFAULT_THEME,
  id: HERMES_PASTEL_THEME_ID,
  fontSize: 12,
  colors: {
    light: pastelPalette(DEFAULT_THEME.colors.light, lightPastels),
    dark: pastelPalette(DEFAULT_THEME.colors.dark, darkPastels, "#0f172a"),
  },
};
