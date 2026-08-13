import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Languages,
  PenTool,
  Waves,
} from "lucide-react-native";
import { ScreenShell } from "@/components/ScreenShell";
import { DailyGoalCard } from "@/components/DailyGoalCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { fetchSrsQueue, useSrsDecks, useSrsSync } from "@/hooks/useSrs";
import { useTroubleWordCount } from "@/hooks/useTroubleWords";
import { srsDeckLabel } from "@/i18n/srsDeckLabels";
import { startSrsSession } from "@/lib/srsStore";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";
import { JLPT_LEVELS, SRS_DECK_ORDER, type SrsDeckType, type SrsSortMode } from "@/types/srs";

const DECK_ICONS = {
  word: Languages,
  pronunciation: Waves,
  meaning: BookOpen,
  example: FileText,
  drawing: PenTool,
} as const;

const HUB_SORT_OPTIONS: SrsSortMode[] = [
  "jlpt-asc",
  "jlpt-desc",
  "date-asc",
  "date-desc",
];

function sortLabelKey(mode: SrsSortMode): string {
  switch (mode) {
    case "jlpt-asc":
      return "srs.sort.jlptAsc";
    case "jlpt-desc":
      return "srs.sort.jlptDesc";
    case "date-asc":
      return "srs.sort.dateAsc";
    case "date-desc":
      return "srs.sort.dateDesc";
    default:
      return "srs.sort.dueAsc";
  }
}

export default function SrsHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { data: decks = [], isLoading } = useSrsDecks();
  const sync = useSrsSync();
  const { data: troubleCount = 0, isLoading: troubleLoading } = useTroubleWordCount();

  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<SrsSortMode>("jlpt-asc");
  const [sortOpen, setSortOpen] = useState(false);
  const [starting, setStarting] = useState<SrsDeckType | null>(null);

  useEffect(() => {
    sync.mutate();
  }, []);

  function toggleJlpt(level: string) {
    setSelectedJlpt((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function statsFor(deck: SrsDeckType) {
    return decks.find((d) => d.deckType === deck) ?? { total: 0, due: 0, new: 0 };
  }

  async function startDeck(deck: SrsDeckType) {
    setStarting(deck);
    try {
      const jlptLevels = [...selectedJlpt];
      let items = await fetchSrsQueue(deck, {
        jlptLevels,
        sort,
      });
      if (deck === "drawing") {
        items = items.filter((item) => /[\u4e00-\u9fff]/.test(item.word.kanji));
      }
      if (items.length === 0) {
        Alert.alert(t("common.confirmTitle"), t("srs.hub.noCardsWithFilters"));
        return;
      }
      const label = srsDeckLabel(t, deck);
      startSrsSession(deck, items, label.title, "/srs", {
        jlptLevels,
        sort,
      });
      router.push("/srs/study" as Href);
    } finally {
      setStarting(null);
    }
  }

  const allJlptActive = selectedJlpt.size === 0;

  return (
    <ScreenShell
      header={
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.7 }]}
        >
          <ArrowLeft size={18} color={theme.appTextMuted} />
          <Text style={styles.backTitle}>{t("nav.srs")}</Text>
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("srs.hub.title")}</Text>
        <Text style={styles.subtitle}>{t("srs.hub.subtitle")}</Text>

        <DailyGoalCard variant="banner" />

        <View style={styles.filters}>
          <Text style={styles.filterLabel}>{t("srs.hub.jlptFilter")}</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setSelectedJlpt(new Set())}
              style={[styles.chip, allJlptActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, allJlptActive && styles.chipTextActive]}>
                {t("common.all")}
              </Text>
            </Pressable>
            {JLPT_LEVELS.map((lv) => {
              const active = selectedJlpt.has(lv);
              return (
                <Pressable
                  key={lv}
                  onPress={() => toggleJlpt(lv)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {lv}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filters}>
          <Text style={styles.filterLabel}>{t("srs.hub.sortLabel")}</Text>
          <View style={styles.sortWrap}>
            <Pressable
              onPress={() => setSortOpen((open) => !open)}
              style={({ pressed }) => [
                styles.sortTrigger,
                sortOpen && styles.sortTriggerOpen,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.sortTriggerText}>{t(sortLabelKey(sort))}</Text>
              <ChevronDown
                size={18}
                color={theme.appTextMuted}
                style={{ transform: [{ rotate: sortOpen ? "180deg" : "0deg" }] }}
              />
            </Pressable>
            {sortOpen ? (
              <View style={styles.sortMenu}>
                {HUB_SORT_OPTIONS.map((option) => {
                  const active = sort === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSort(option);
                        setSortOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.sortOption,
                        active && styles.sortOptionActive,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          active && styles.sortOptionTextActive,
                        ]}
                      >
                        {t(sortLabelKey(option))}
                      </Text>
                      {active ? <Check size={16} color={theme.main500} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <LoadingPlaceholder padding="lg" style={styles.center} />
        ) : (
          <View style={styles.deckList}>
            {SRS_DECK_ORDER.map((deck) => {
              const stats = statsFor(deck);
              const Icon = DECK_ICONS[deck];
              const label = srsDeckLabel(t, deck);
              const loading = starting === deck;
              const reviewCount = stats.due + stats.new;
              return (
                <Pressable
                  key={deck}
                  onPress={() => startDeck(deck)}
                  disabled={loading || isLoading}
                  style={({ pressed }) => [
                    styles.deckCard,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={styles.deckIcon}>
                    <Icon size={20} color={theme.main500} />
                  </View>
                  <View style={styles.deckBody}>
                    <Text style={styles.deckTitle}>{label.title}</Text>
                    <Text style={styles.deckSub}>{label.subtitle}</Text>
                    <Text style={styles.deckMeta}>
                      {isLoading
                        ? t("common.loading")
                        : reviewCount > 0
                          ? `${t("srs.hub.cardsReady", { count: reviewCount })}${stats.total > 0 ? t("srs.hub.totalCards", { count: stats.total }) : ""}`
                          : `${t("srs.hub.noCardsToday")}${stats.total > 0 ? t("srs.hub.totalCards", { count: stats.total }) : ""}`}
                    </Text>
                  </View>
                  {loading ? (
                    <LoadingSpinner size={18} color={theme.main500} />
                  ) : (
                    <ChevronRight size={18} color={theme.appTextMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.push("/srs/trouble" as Href)}
          style={({ pressed }) => [styles.troubleCard, pressed && { opacity: 0.9 }]}
        >
          <AlertCircle size={20} color={theme.main500} />
          <View style={styles.troubleBody}>
            <Text style={styles.troubleTitle}>{t("srs.hub.troubleWordsTile")}</Text>
            <Text style={styles.troubleSub}>
              {troubleLoading
                ? t("common.loading")
                : t("srs.hub.troubleWordsCount", { count: troubleCount })}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.appTextMuted} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBg },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 4,
      marginLeft: -4,
    },
    backTitle: navBackTitleStyle(theme, colorScheme, { letterSpacing: 1.2 }),
    content: { padding: 16, paddingBottom: 40, gap: 16 },
    title: { fontSize: 22, fontWeight: "700", color: theme.appText },
    subtitle: { fontSize: 14, color: theme.appTextSecondary, marginTop: -8 },
    filters: { gap: 8 },
    filterLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.appTextMuted,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.appSurface,
    },
    chipActive: { borderColor: theme.main500, backgroundColor: theme.appAccent },
    chipText: { fontSize: 12, fontWeight: "600", color: theme.appTextSecondary },
    chipTextActive: { color: theme.main500 },
    sortWrap: { gap: 0 },
    sortTrigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.appSurface,
    },
    sortTriggerOpen: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomColor: theme.appBorder,
    },
    sortTriggerText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.appText,
    },
    sortMenu: {
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: theme.appBorderStrong,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.appSurface,
    },
    sortOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
    },
    sortOptionActive: { backgroundColor: theme.appAccent },
    sortOptionText: { flex: 1, fontSize: 14, color: theme.appTextSecondary },
    sortOptionTextActive: { color: theme.main500, fontWeight: "600" },
    center: { paddingVertical: 40, alignItems: "center" },
    deckList: { gap: 8 },
    deckCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.appSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      borderRadius: 16,
      padding: 16,
    },
    deckCardDisabled: { opacity: 0.55 },
    deckIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.appAccent,
      alignItems: "center",
      justifyContent: "center",
    },
    deckBody: { flex: 1, minWidth: 0 },
    deckTitle: { fontSize: 16, fontWeight: "700", color: theme.appText },
    deckSub: { fontSize: 12, color: theme.appTextMuted, marginTop: 2 },
    deckMeta: { fontSize: 12, fontWeight: "600", color: theme.main500, marginTop: 4 },
    troubleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.appSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      borderRadius: 16,
      padding: 16,
      marginTop: 4,
    },
    troubleBody: { flex: 1 },
    troubleTitle: { fontSize: 15, fontWeight: "700", color: theme.appText },
    troubleSub: { fontSize: 12, color: theme.appTextMuted, marginTop: 2 },
  });
}
