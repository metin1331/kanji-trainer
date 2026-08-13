import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { ScreenShell } from "@/components/ScreenShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import {
  fetchTroubleSrsQueue,
  useDismissTroubleWord,
  useTroubleWords,
} from "@/hooks/useTroubleWords";
import { srsDeckLabel } from "@/i18n/srsDeckLabels";
import { startSrsSession } from "@/lib/srsStore";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";
import type { SrsDeckType } from "@/types/srs";

export default function TroubleWordsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { data, isLoading } = useTroubleWords();
  const dismiss = useDismissTroubleWord();
  const [starting, setStarting] = useState<SrsDeckType | null>(null);

  const items = data?.items ?? [];

  async function studyDeck(deck: SrsDeckType, wordIds: number[]) {
    if (wordIds.length === 0) return;
    setStarting(deck);
    try {
      const queue = await fetchTroubleSrsQueue(deck, wordIds);
      if (queue.length === 0) {
        Alert.alert(t("common.confirmTitle"), t("troubleWords.noCardsForDeck"));
        return;
      }
      const label = srsDeckLabel(t, deck);
      startSrsSession(
        deck,
        queue,
        t("troubleWords.sessionTitle", { label: label.title }),
        "/srs/trouble",
        { jlptLevels: [], sort: "due-asc" },
      );
      router.push("/srs/study" as Href);
    } finally {
      setStarting(null);
    }
  }

  return (
    <ScreenShell
      header={
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.7 }]}
        >
          <ArrowLeft size={18} color={theme.appTextMuted} />
          <Text style={styles.backTitle}>{t("srs.hub.troubleWordsTile")}</Text>
        </Pressable>
      }
    >
      {isLoading ? (
        <LoadingPlaceholder style={styles.center} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.wordId)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("troubleWords.empty")}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.kanji}>{item.kanji}</Text>
                {item.pronunciation ? (
                  <Text style={styles.sub}>{item.pronunciation}</Text>
                ) : null}
                <Text style={styles.mistakes}>
                  {t("troubleWords.mistakeCount", { count: item.totalMistakes })}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    t("common.confirmTitle"),
                    t("troubleWords.dismissConfirm"),
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: () => dismiss.mutate({ wordId: item.wordId }),
                      },
                    ],
                  );
                }}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>×</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            items.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.footerLabel}>{t("troubleWords.pickDeck")}</Text>
                {(["word", "pronunciation", "meaning", "example"] as SrsDeckType[]).map(
                  (deck) => (
                    <Pressable
                      key={deck}
                      onPress={() =>
                        studyDeck(
                          deck,
                          items.map((w) => w.wordId),
                        )
                      }
                      disabled={starting === deck}
                      style={styles.deckBtn}
                    >
                      <Text style={styles.deckBtnText}>{srsDeckLabel(t, deck).title}</Text>
                      {starting === deck ? (
                        <LoadingSpinner size={14} color={theme.main500} />
                      ) : (
                        <ChevronRight size={16} color={theme.appTextMuted} />
                      )}
                    </Pressable>
                  ),
                )}
              </View>
            ) : null
          }
        />
      )}
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 4,
      marginLeft: -4,
    },
    backTitle: navBackTitleStyle(theme, colorScheme, { letterSpacing: 1.2 }),
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { padding: 16, gap: 8, paddingBottom: 40 },
    empty: { textAlign: "center", color: theme.appTextMuted, padding: 40 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.appSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      padding: 14,
      gap: 8,
    },
    cardBody: { flex: 1 },
    kanji: { fontSize: 17, fontWeight: "700", color: theme.appText },
    sub: { fontSize: 12, color: theme.appTextMuted, marginTop: 2 },
    mistakes: { fontSize: 11, color: theme.danger, marginTop: 4, fontWeight: "600" },
    dismissBtn: { padding: 8 },
    dismissText: { fontSize: 22, color: theme.appTextMuted, lineHeight: 22 },
    footer: { marginTop: 16, gap: 8 },
    footerLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 4,
    },
    deckBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.appSurface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      padding: 14,
    },
    deckBtnText: { fontSize: 15, fontWeight: "600", color: theme.appText },
  });
}
