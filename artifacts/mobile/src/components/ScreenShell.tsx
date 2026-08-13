import { useMemo, type ReactNode } from "react";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

export const SCREEN_HEADER_PAD = {
  top: 12,
  horizontal: 20,
  bottom: 16,
} as const;

type Props = {
  children: ReactNode;
  header?: ReactNode;
  headerStyle?: ViewStyle;
  /** Fill color behind status bar / notch. Defaults to header surface or page bg. */
  statusBarColor?: string;
  /** Pad the body for the home-indicator safe area. */
  bottomInset?: boolean;
};

export function useScreenHeaderInset(
  extraTop = SCREEN_HEADER_PAD.top,
): number {
  const insets = useSafeAreaInsets();
  return insets.top + extraTop;
}

/** Page shell: status bar matches header surface; body uses appBg. */
export function ScreenShell({
  children,
  header,
  headerStyle,
  statusBarColor,
  bottomInset = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const barColor =
    statusBarColor ?? (header != null ? theme.appSurface : theme.appBg);

  return (
    <View
      style={[
        styles.root,
        bottomInset ? { paddingBottom: insets.bottom } : null,
      ]}
    >
      {Platform.OS === "android" ? (
        <RNStatusBar
          backgroundColor={barColor}
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        />
      ) : null}
      {header != null ? (
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + SCREEN_HEADER_PAD.top },
            headerStyle,
          ]}
        >
          {header}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.appBg,
    },
    header: {
      backgroundColor: theme.appSurface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.appBorder,
      paddingHorizontal: SCREEN_HEADER_PAD.horizontal,
      paddingBottom: SCREEN_HEADER_PAD.bottom,
    },
    body: {
      flex: 1,
    },
  });
}
