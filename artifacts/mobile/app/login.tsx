import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { DismissKeyboardView } from "@/components/DismissKeyboardView";
import { FocusRingInput } from "@/components/FocusRingInput";
import { ScreenShell } from "@/components/ScreenShell";
import { useTranslation } from "@/i18n/I18nProvider";
import { getApiOrigin } from "@/lib/apiConfig";
import { useTheme } from "@/theme/ThemeProvider";
import { ColorScheme } from "@/settings/appSettings";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const apiOrigin = getApiOrigin();

  async function onSubmit() {
    setError("");
    if (!apiOrigin) {
      setError(t("auth.apiMissing"));
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell bottomInset>
      <DismissKeyboardView style={[styles.flex, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.container}>
            <Text style={styles.title}>{t("auth.loginTitle")}</Text>
            <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>

            {!apiOrigin ? (
              <Text style={styles.apiWarning}>{t("auth.apiMissing")}</Text>
            ) : null}

            <Text style={styles.label}>{t("auth.email")}</Text>
            <FocusRingInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Text style={[styles.label, styles.labelGap]}>{t("auth.password")}</Text>
            <FocusRingInput
              value={password}
              onChangeText={setPassword}
              autoComplete="password"
              passwordToggle
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                (busy || pressed) && { opacity: 0.85 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={styles.buttonText}>{t("auth.login")}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </DismissKeyboardView>
    </ScreenShell>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], colorScheme: ColorScheme) {
  const isDark = colorScheme === "dark";
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.appBg,
    },
    flex: {
      flex: 1,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      maxWidth: 420,
      width: "100%",
      alignSelf: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.appText,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.appTextSecondary,
      marginBottom: 24,
    },
    apiWarning: {
      fontSize: 13,
      color: theme.main600,
      backgroundColor: theme.appAccent,
      padding: 10,
      borderRadius: 8,
      marginBottom: 16,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 4,
    },
    labelGap: {
      marginTop: 12,
    },
    error: {
      marginTop: 12,
      fontSize: 13,
      color: theme.danger,
    },
    button: {
      marginTop: 20,
      backgroundColor: isDark ? theme.main600 : theme.main500,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonText: {
      color: theme.white,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}
