// Turns a theme_settings row into a CSS variable block so the whole app
// re-themes from one place. Falls back to defaults when a row is missing.
import { DEFAULT_THEME } from "./site";

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
