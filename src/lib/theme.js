import { DEFAULT_THEME } from "./defaults";

export { DEFAULT_THEME };

export const THEME_COLOR_KEYS = [
  "primary_color",
  "accent_color",
  "background_color",
  "surface_color",
  "text_color",
  "muted_color",
  "border_color",
];

function colorSet({
  primary_color,
  accent_color,
  background_color,
  surface_color,
  text_color,
  muted_color,
  border_color,
}) {
  return {
    primary_color,
    accent_color,
    background_color,
    surface_color,
    text_color,
    muted_color,
    border_color,
  };
}

export const THEME_PRESETS = [
  {
    id: "harvest",
    name: "Harvest",
    description: "Warm olive and terracotta",
    ...colorSet(DEFAULT_THEME),
  },
  {
    id: "fresh-green",
    name: "Garden",
    description: "Fresh greens for groceries",
    ...colorSet({
      primary_color: "#1B4332",
      accent_color: "#40916C",
      background_color: "#F4F7F5",
      surface_color: "#FFFFFF",
      text_color: "#081C15",
      muted_color: "#6B7C72",
      border_color: "#D8E3DC",
    }),
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep teal with coral accent",
    ...colorSet({
      primary_color: "#0B3D4A",
      accent_color: "#E07A5F",
      background_color: "#F6F4F1",
      surface_color: "#FFFFFF",
      text_color: "#123039",
      muted_color: "#6E7C80",
      border_color: "#D9E2E4",
    }),
  },
  {
    id: "citrus",
    name: "Citrus",
    description: "Bright market orange",
    ...colorSet({
      primary_color: "#1F2933",
      accent_color: "#E85D04",
      background_color: "#FFF8F1",
      surface_color: "#FFFFFF",
      text_color: "#1F2933",
      muted_color: "#8A8175",
      border_color: "#F0E4D4",
    }),
  },
  {
    id: "navy",
    name: "Navy Gold",
    description: "Classic navy and gold",
    ...colorSet({
      primary_color: "#14213D",
      accent_color: "#C9A227",
      background_color: "#F7F6F2",
      surface_color: "#FFFFFF",
      text_color: "#14213D",
      muted_color: "#7A7E87",
      border_color: "#E2E0D8",
    }),
  },
  {
    id: "berry",
    name: "Berry",
    description: "Wine and blush tones",
    ...colorSet({
      primary_color: "#4A1C40",
      accent_color: "#C9184A",
      background_color: "#FBF6F8",
      surface_color: "#FFFFFF",
      text_color: "#2B1024",
      muted_color: "#8A6A7C",
      border_color: "#EADCE4",
    }),
  },
  {
    id: "charcoal",
    name: "Charcoal",
    description: "Clean modern contrast",
    ...colorSet({
      primary_color: "#171717",
      accent_color: "#2563EB",
      background_color: "#F5F5F5",
      surface_color: "#FFFFFF",
      text_color: "#171717",
      muted_color: "#737373",
      border_color: "#E5E5E5",
    }),
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Soft rose and cocoa",
    ...colorSet({
      primary_color: "#3D2C2E",
      accent_color: "#D45D79",
      background_color: "#FDF7F7",
      surface_color: "#FFFFFF",
      text_color: "#3D2C2E",
      muted_color: "#9A8588",
      border_color: "#EEDFE1",
    }),
  },
];

export function matchThemePreset(theme) {
  if (!theme) return "harvest";
  const found = THEME_PRESETS.find((preset) =>
    THEME_COLOR_KEYS.every(
      (key) =>
        String(theme[key] || "").toLowerCase() ===
        String(preset[key] || "").toLowerCase(),
    ),
  );
  return found?.id || null;
}

export function themeVariables(theme) {
  const t = theme || DEFAULT_THEME;
  return `:root{
--brand-primary:${t.primary_color || DEFAULT_THEME.primary_color};
--brand-accent:${t.accent_color || DEFAULT_THEME.accent_color};
--brand-background:${t.background_color || DEFAULT_THEME.background_color};
--brand-surface:${t.surface_color || DEFAULT_THEME.surface_color};
--brand-text:${t.text_color || DEFAULT_THEME.text_color};
--brand-muted:${t.muted_color || DEFAULT_THEME.muted_color};
--brand-border:${t.border_color || DEFAULT_THEME.border_color};
}`;
}
