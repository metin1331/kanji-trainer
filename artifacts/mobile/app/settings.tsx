import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Database,
  Languages,
  Link2,
  LogOut,
  Palette,
  User,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { ScreenShell } from "@/components/ScreenShell";
import { Toggle } from "@/components/Toggle";
import { useAuth } from "@/auth/AuthProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useDailyGoal } from "@/hooks/useDailyGoal";
import { useWords } from "@/hooks/useWords";
import { LOCALES } from "@/i18n/messages";
import { srsDeckLabel } from "@/i18n/srsDeckLabels";
import { useTranslation } from "@/i18n/I18nProvider";
import {
  DAILY_GOAL_DECK_IDS,
  DAILY_TARGET_PRESETS,
} from "@/lib/dailyGoal";
import { sanitizeSrsExamples } from "@/lib/srsExamples";
import { relinkAllWordsSrsExamples } from "@/lib/wordLinking";
import { useTheme } from "@/theme/ThemeProvider";
import {
  getPalette,
  PALETTE_NAMES,
  SHADES,
  type PaletteName,
} from "@/theme/palettes";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";

type Section = "styling" | "srs" | "database" | "language" | "account";

const SECTIONS: {
  id: Section;
  labelKey: string;
  Icon: typeof Palette;
}[] = [
  { id: "styling", labelKey: "settings.styling.nav", Icon: Palette },
  { id: "srs", labelKey: "settings.srs.nav", Icon: BookOpen },
  { id: "database", labelKey: "settings.database.nav", Icon: Database },
  { id: "language", labelKey: "settings.language.nav", Icon: Languages },
  { id: "account", labelKey: "settings.account.nav", Icon: User },
];

export default function SettingsScreen() {
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, paletteName, colorScheme, setPalette, setColorScheme } =
    useTheme();
  const { settings, patchSettings } = useAppSettings();
  const { decks, setDeckTarget } = useDailyGoal();
  const { words, updateWordAsync } = useWords();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const isDark = colorScheme === "dark";

  const [section, setSection] = useState<Section>("styling");
  const [relinkBusy, setRelinkBusy] = useState(false);
  const [relinkProgress, setRelinkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function relinkAllExamples() {
    const withExamples = words.filter((w) => w.srsExamples?.length);
    if (withExamples.length === 0) {
      setStatusMessage(t("settings.database.relink.noWords"));
      return;
    }

    Alert.alert(
      t("common.confirmTitle"),
      t("settings.database.relink.confirm", { count: withExamples.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          onPress: () => void runRelink(withExamples.length),
        },
      ],
    );
  }

  async function runRelink(expectedCount: number) {
    setRelinkBusy(true);
    setStatusMessage(null);
    setRelinkProgress({ done: 0, total: expectedCount });
    try {
      const results = await relinkAllWordsSrsExamples(words, (done, total) => {
        setRelinkProgress({ done, total });
      });
      let saved = 0;
      for (const { wordId, srsExamples } of results) {
        try {
          await updateWordAsync(wordId, {
            srsExamples: sanitizeSrsExamples(srsExamples),
          });
          saved++;
        } catch {
          // continue with remaining words
        }
      }
      if (saved === 0) {
        setStatusMessage(t("settings.database.relink.failed"));
        return;
      }
      const usedFallback = results.some((r) => r.usedFallback);
      const success = t("settings.database.relink.success", { count: saved });
      setStatusMessage(
        usedFallback
          ? `${success} ${t("settings.database.relink.fallbackNote")}`
          : success,
      );
    } catch {
      setStatusMessage(t("settings.database.relink.failed"));
    } finally {
      setRelinkBusy(false);
      setRelinkProgress(null);
    }
  }

  return (
    <ScreenShell
      header={
        <>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.7 }]}
          >
            <ArrowLeft size={18} color={theme.appTextMuted} />
            <Text style={styles.backTitle}>{t("settings.title")}</Text>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sectionNav}
            contentContainerStyle={styles.sectionNavContent}
          >
            {SECTIONS.map(({ id, labelKey, Icon }) => {
              const active = section === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setSection(id);
                    setStatusMessage(null);
                  }}
                  style={({ pressed }) => [
                    styles.sectionChip,
                    active && styles.sectionChipActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Icon
                    size={15}
                    color={active ? theme.main500 : theme.appTextSecondary}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.sectionChipText,
                      active && styles.sectionChipTextActive,
                    ]}
                  >
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      }
      headerStyle={styles.headerBlock}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="never"
      >
        {section === "styling" ? (
          <>
            <Text style={styles.sectionTitle}>{t("settings.styling.title")}</Text>
            <Text style={styles.sectionDesc}>{t("settings.styling.description")}</Text>

            <View style={styles.toggleWrap}>
              <Toggle
                label={t("settings.styling.darkMode.label")}
                description={t("settings.styling.darkMode.description")}
                checked={colorScheme === "dark"}
                onChange={(v) => {
                  const scheme = v ? "dark" : "light";
                  setColorScheme(scheme);
                  void patchSettings({ colorScheme: scheme });
                }}
              />
            </View>

            <View style={styles.paletteGrid}>
              {PALETTE_NAMES.map((name) => {
                const colors = getPalette(name);
                const selected = paletteName === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setPalette(name as PaletteName)}
                    style={({ pressed }) => [
                      styles.paletteCard,
                      {
                        borderColor: selected ? isDark ? theme.main600 : theme.main500 : theme.appBorderStrong,
                      },
                      selected && styles.paletteCardSelected,
                      pressed && { opacity: 0.95 },
                    ]}
                  >
                    <View style={styles.paletteHeader}>
                      <Text style={styles.paletteName}>{name}</Text>
                      {selected ? (
                        <View style={styles.selectedRow}>
                          <Check size={14} color={theme.main500} strokeWidth={2.5} />
                          <Text style={styles.selectedText}>
                            {t("settings.styling.selected")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.swatches}>
                      {SHADES.map((shade) => (
                        <View
                          key={shade}
                          style={[styles.swatch, { backgroundColor: colors[shade] }]}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {section === "srs" ? (
          <>
            <Text style={styles.sectionTitle}>{t("settings.srs.title")}</Text>
            <Text style={styles.sectionDesc}>{t("settings.srs.description")}</Text>

            <View style={styles.stack}>
              <Toggle
                label={t("settings.srs.wordLinks.label")}
                description={t("settings.srs.wordLinks.description")}
                checked={settings.srsSentenceWordLinks}
                onChange={(v) => void patchSettings({ srsSentenceWordLinks: v })}
              />
              <Toggle
                label={t("settings.srs.romajiInput.label")}
                description={t("settings.srs.romajiInput.description")}
                checked={settings.srsRomajiInput}
                onChange={(v) => void patchSettings({ srsRomajiInput: v })}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("settings.srs.dailyGoal.label")}</Text>
              <Text style={styles.cardDesc}>{t("settings.srs.dailyGoal.description")}</Text>
              <Text style={styles.cardHint}>{t("dailyGoal.settingsHint")}</Text>

              {DAILY_GOAL_DECK_IDS.map((deckId) => {
                const deck = decks.find((d) => d.deck === deckId);
                const target = deck?.target ?? 0;
                const deckName = srsDeckLabel(t, deckId).title;

                return (
                  <View key={deckId} style={styles.deckBlock}>
                    <Text style={styles.deckLabel}>{deckName}</Text>
                    <View style={styles.presetRow}>
                      {DAILY_TARGET_PRESETS.map((preset) => (
                        <Pressable
                          key={preset}
                          onPress={() => setDeckTarget(deckId, preset)}
                          style={[
                            styles.presetChip,
                            target === preset && styles.presetChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              target === preset && styles.presetChipTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => setDeckTarget(deckId, 0)}
                        style={[
                          styles.presetChip,
                          styles.presetOff,
                          target === 0 && styles.presetOffActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            target === 0 && styles.presetOffTextActive,
                          ]}
                        >
                          {t("dailyGoal.off")}
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={String(target)}
                      onChangeText={(text) => {
                        const n = Number(text);
                        if (!Number.isNaN(n)) setDeckTarget(deckId, n);
                      }}
                      keyboardType="number-pad"
                      style={styles.targetInput}
                      accessibilityLabel={t("dailyGoal.settingsTargetDeck", {
                        deck: deckName,
                      })}
                    />
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {section === "database" ? (
          <>
            <Text style={styles.sectionTitle}>{t("settings.database.title")}</Text>
            <Text style={styles.sectionDesc}>{t("settings.database.description")}</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("settings.database.relink.title")}</Text>
              <Text style={styles.cardDesc}>{t("settings.database.relink.description")}</Text>
              <Pressable
                onPress={() => void relinkAllExamples()}
                disabled={relinkBusy || words.length === 0}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  (relinkBusy || words.length === 0) && styles.disabledBtn,
                  pressed && !relinkBusy && words.length > 0 ? { opacity: 0.85 } : null,
                ]}
              >
                {relinkBusy ? (
                  <ActivityIndicator size="small" color={theme.main500} />
                ) : (
                  <Link2 size={16} color={theme.appText} />
                )}
                <Text style={styles.outlineBtnText}>
                  {t("settings.database.relink.button")}
                </Text>
              </Pressable>
              {relinkProgress ? (
                <Text style={styles.progressText}>
                  {t("settings.database.relink.progress", {
                    done: relinkProgress.done,
                    total: relinkProgress.total,
                  })}
                </Text>
              ) : null}
            </View>

            {statusMessage ? (
              <Text style={styles.statusMessage}>{statusMessage}</Text>
            ) : null}
          </>
        ) : null}

        {section === "language" ? (
          <>
            <Text style={styles.sectionTitle}>{t("settings.language.title")}</Text>
            <Text style={styles.sectionDesc}>{t("settings.language.description")}</Text>

            <View style={styles.languageGrid}>
              {LOCALES.map(({ id, labelKey }) => {
                const selected = locale === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      setLocale(id);
                      void patchSettings({ locale: id });
                    }}
                    style={({ pressed }) => [
                      styles.languageCard,
                      selected && styles.languageCardSelected,
                      pressed && { opacity: 0.95 },
                    ]}
                  >
                    <Text style={styles.languageLabel}>{t(labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {section === "account" ? (
          <>
            <Text style={styles.sectionTitle}>{t("settings.account.title")}</Text>
            <Text style={styles.sectionDesc}>{t("settings.account.description")}</Text>

            {user ? (
              <>
                <View style={styles.card}>
                  <View style={styles.accountField}>
                    <Text style={styles.accountLabel}>{t("settings.account.email")}</Text>
                    <Text style={styles.accountValue}>{user.email}</Text>
                  </View>
                  <View style={styles.accountField}>
                    <Text style={styles.accountLabel}>{t("settings.account.role")}</Text>
                    <Text style={styles.accountValue}>
                      {user.role === "admin"
                        ? t("auth.roleAdmin")
                        : user.role === "moderator"
                          ? t("auth.roleModerator")
                          : t("auth.roleUser")}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={async () => {
                    await logout();
                    router.replace("/login");
                  }}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    styles.logoutBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <LogOut size={16} color="#dc2626" />
                  <Text style={styles.logoutBtnText}>{t("settings.account.logout")}</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardDesc}>{t("settings.account.notSignedIn")}</Text>
                <Pressable
                  onPress={() => router.push("/login")}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>{t("settings.account.signIn")}</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], colorScheme: ColorScheme) {
  const isDark = colorScheme === "dark";
  return StyleSheet.create({
    headerBlock: {
      gap: 0,
      paddingHorizontal: 0,
      paddingBottom: 0,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      padding: 4,
      marginLeft: 16,
      marginBottom: 12,
    },
    backTitle: navBackTitleStyle(theme, colorScheme),
    sectionNav: {
      flexGrow: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
    },
    sectionNavContent: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    sectionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.appMuted,
    },
    sectionChipActive: {
      backgroundColor: theme.appAccent,
    },
    sectionChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.appTextSecondary,
    },
    sectionChipTextActive: {
      color: theme.main500,
    },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.appText,
      marginBottom: 4,
    },
    sectionDesc: {
      fontSize: 14,
      color: theme.appTextSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    toggleWrap: { marginBottom: 20, maxWidth: 520 },
    stack: { gap: 12, marginBottom: 20 },
    paletteGrid: { gap: 12 },
    paletteCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.appSurface,
    },
    paletteCardSelected: {
      boxShadow: `0 0 0 0px ${isDark ? theme.main600 : theme.main500}`,
    },
    paletteHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    paletteName: {
      fontSize: 14,
      fontWeight: "600",
      textTransform: "capitalize",
      color: theme.appText,
    },
    selectedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    selectedText: { fontSize: 12, fontWeight: "500", color: theme.main500 },
    swatches: {
      flexDirection: "row",
      height: 24,
      borderRadius: 8,
      overflow: "hidden",
    },
    swatch: { flex: 1, minWidth: 0 },
    card: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      padding: 16,
      gap: 10,
      backgroundColor: theme.appSurface,
    },
    cardTitle: { fontSize: 14, fontWeight: "600", color: theme.appText },
    cardDesc: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.appTextSecondary,
    },
    cardHint: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.appTextMuted,
    },
    deckBlock: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.appBorder,
      borderRadius: 10,
      padding: 12,
      gap: 8,
      backgroundColor: theme.appMuted,
    },
    deckLabel: { fontSize: 14, fontWeight: "600", color: theme.appText },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    presetChip: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.appSurface,
    },
    presetChipActive: {
      borderColor: theme.main500,
      backgroundColor: theme.main500,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.appTextSecondary,
    },
    presetChipTextActive: { color: "#fff" },
    presetOff: {},
    presetOffActive: {
      borderColor: "#4b5563",
      backgroundColor: "#4b5563",
    },
    presetOffTextActive: { color: "#fff" },
    targetInput: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.appText,
      backgroundColor: theme.appSurface,
    },
    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.appSurface,
      alignSelf: "flex-start",
    },
    outlineBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.appText,
    },
    disabledBtn: { opacity: 0.45 },
    progressText: {
      fontSize: 12,
      color: theme.appTextSecondary,
      fontVariant: ["tabular-nums"],
    },
    statusMessage: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: "500",
      color: theme.main600,
    },
    languageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    languageCard: {
      flex: 1,
      minWidth: "45%",
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      padding: 16,
      backgroundColor: theme.appSurface,
      gap: 8,
    },
    languageCardSelected: {
      borderColor: isDark ? theme.main600 : theme.main500,
      borderWidth: 2,
    },
    languageLabel: { fontSize: 14, fontWeight: "600", color: theme.appText },
    accountField: { gap: 4 },
    accountLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.appTextMuted,
    },
    accountValue: { fontSize: 14, color: theme.appText },
    logoutBtn: {
      marginTop: 8,
      borderColor: "#fecaca",
    },
    logoutBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#dc2626",
    },
    primaryBtn: {
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
  });
}
