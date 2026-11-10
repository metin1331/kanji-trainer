import { getAppSettings, saveAppSettings, type ColorScheme } from "../settings/appSettings";

export type { ColorScheme };

const THEME_CANVAS: Record<ColorScheme, string> = {
  light: "#f5f7fa",
  dark: "#0f1117",
};

function replaceThemeColor(color: string) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

export function applyColorScheme(scheme: ColorScheme, instant = true) {
  const root = document.documentElement;
  const canvas = THEME_CANVAS[scheme];
  if (instant) root.classList.add("theme-switching");
  root.classList.toggle("dark", scheme === "dark");
  root.style.colorScheme = scheme;
  root.style.backgroundColor = canvas;
  document.body.style.backgroundColor = canvas;
  replaceThemeColor(canvas);
  if (instant) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
      });
    });
  }
}

export function getStoredColorScheme(): ColorScheme {
  return getAppSettings().colorScheme;
}

export function setColorScheme(scheme: ColorScheme) {
  applyColorScheme(scheme);
  saveAppSettings({ colorScheme: scheme });
}

export function initColorScheme() {
  applyColorScheme(getStoredColorScheme(), false);
}
