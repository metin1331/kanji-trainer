import type { TextStyle } from "react-native";
import type { ColorScheme } from "@/settings/appSettings";
import type { useTheme } from "@/theme/ThemeProvider";

export function backTitleColor(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
): string {
  return colorScheme === "dark" ? theme.main600 : theme.main500;
}

export function navBackTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
  extra?: TextStyle,
): TextStyle {
  return {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: backTitleColor(theme, colorScheme),
    ...extra,
  };
}
