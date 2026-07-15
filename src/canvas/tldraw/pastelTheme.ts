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

export const HERMES_CANVAS_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";

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

type FrameRoleColors = {
  stroke: string;
  headingFill: string;
  fill: string;
  text: string;
};

type FramePalette = Partial<Record<TLDefaultColorStyle, FrameRoleColors>>;

const lightFrameColors = {
  "light-violet": {
    stroke: "#7c3aed",
    headingFill: "#ede9fe",
    fill: "#f5f3ff",
    text: "#111827",
  },
  yellow: {
    stroke: "#eab308",
    headingFill: "#fef3c7",
    fill: "#fffbeb",
    text: "#111827",
  },
  green: {
    stroke: "#16a34a",
    headingFill: "#dcfce7",
    fill: "#f0fdf4",
    text: "#111827",
  },
  "light-blue": {
    stroke: "#2563eb",
    headingFill: "#dbeafe",
    fill: "#eff6ff",
    text: "#111827",
  },
} satisfies FramePalette;

const darkFrameColors = {
  "light-violet": {
    stroke: "#a78bfa",
    headingFill: "#2e2652",
    fill: "#1e1b2e",
    text: "#f8fafc",
  },
  yellow: {
    stroke: "#facc15",
    headingFill: "#342b10",
    fill: "#211d0f",
    text: "#f8fafc",
  },
  green: {
    stroke: "#4ade80",
    headingFill: "#173622",
    fill: "#0f2116",
    text: "#f8fafc",
  },
  "light-blue": {
    stroke: "#60a5fa",
    headingFill: "#162d4f",
    fill: "#101e33",
    text: "#f8fafc",
  },
} satisfies FramePalette;

function pastelColor(
  base: TLDefaultColor,
  value: string,
  text = "#111827",
  frameColors?: FrameRoleColors,
): TLDefaultColor {
  const frame = frameColors ?? {
    stroke: value,
    headingFill: value,
    fill: value,
    text,
  };

  return {
    ...base,
    solid: value,
    semi: value,
    pattern: value,
    fill: value,
    linedFill: value,
    frameHeadingStroke: frame.stroke,
    frameHeadingFill: frame.headingFill,
    frameStroke: frame.stroke,
    frameFill: frame.fill,
    frameText: frame.text,
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
  framePalette: FramePalette = {},
): TLTheme["colors"]["light"] {
  return {
    ...colors,
    black: pastelColor(colors.black, palette.black, text, framePalette.black),
    grey: pastelColor(colors.grey, palette.grey, text, framePalette.grey),
    "light-violet": pastelColor(
      colors["light-violet"],
      palette["light-violet"],
      text,
      framePalette["light-violet"],
    ),
    violet: pastelColor(colors.violet, palette.violet, text, framePalette.violet),
    blue: pastelColor(colors.blue, palette.blue, text, framePalette.blue),
    "light-blue": pastelColor(
      colors["light-blue"],
      palette["light-blue"],
      text,
      framePalette["light-blue"],
    ),
    yellow: pastelColor(colors.yellow, palette.yellow, text, framePalette.yellow),
    orange: pastelColor(colors.orange, palette.orange, text, framePalette.orange),
    green: pastelColor(colors.green, palette.green, text, framePalette.green),
    "light-green": pastelColor(
      colors["light-green"],
      palette["light-green"],
      text,
      framePalette["light-green"],
    ),
    "light-red": pastelColor(
      colors["light-red"],
      palette["light-red"],
      text,
      framePalette["light-red"],
    ),
    red: pastelColor(colors.red, palette.red, text, framePalette.red),
    white: pastelColor(colors.white, palette.white, text, framePalette.white),
  };
}

export const hermesPastelTheme: TLTheme = {
  ...DEFAULT_THEME,
  id: HERMES_PASTEL_THEME_ID,
  fontSize: 12,
  fonts: {
    ...DEFAULT_THEME.fonts,
    draw: {
      ...DEFAULT_THEME.fonts.draw,
      fontFamily: HERMES_CANVAS_FONT_FAMILY,
    },
    sans: {
      ...DEFAULT_THEME.fonts.sans,
      fontFamily: HERMES_CANVAS_FONT_FAMILY,
    },
  },
  colors: {
    light: pastelPalette(
      DEFAULT_THEME.colors.light,
      lightPastels,
      "#111827",
      lightFrameColors,
    ),
    dark: pastelPalette(
      DEFAULT_THEME.colors.dark,
      darkPastels,
      "#0f172a",
      darkFrameColors,
    ),
  },
};
