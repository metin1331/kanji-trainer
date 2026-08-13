import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIconField } from "@/components/CategoryIconField";
import { CategoryTitle } from "@/components/CategoryIcon";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { ScreenShell } from "@/components/ScreenShell";
import { SearchBar } from "@/components/SearchBar";
import { SlideUpModal } from "@/components/SlideUpModal";
import { WordPickerSheet } from "@/components/WordPickerSheet";
import { normalizeCategoryLabel } from "@/lib/categoryMatch";
import { useThemes } from "@/hooks/useThemes";
import { useWords } from "@/hooks/useWords";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";

type ThemeListItem = {
  id: number;
  name: string;
  wordCount: number;
  questionCount?: number;
  iconSvg?: string | null;
};

export default function ThemesHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { themes, isLoading, createTheme } = useThemes();
  const { words } = useWords();

  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState("");
  const [iconSvg, setIconSvg] = useState("");
  const [pickerIds, setPickerIds] = useState<Set<number>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeCategoryLabel(query);
    if (!q) return themes as ThemeListItem[];
    return (themes as ThemeListItem[]).filter((item) =>
      normalizeCategoryLabel(item.name).includes(q),
    );
  }, [themes, query]);

  const closeCreateModal = () => {
    setShowCreate(false);
    setName("");
    setIconSvg("");
    setPickerIds(new Set());
  };

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const created = await createTheme({
        name: name.trim(),
        wordIds: [...pickerIds],
        iconSvg: iconSvg.trim() || null,
      });
      closeCreateModal();
      router.push({ pathname: "/themes/[id]", params: { id: created.id } } as Href);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      header={
        <>
          <View style={styles.headerTop}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.7 }]}
            >
              <ArrowLeft size={18} color={theme.appTextMuted} />
              <Text style={styles.backTitle}>{t("nav.themes")}</Text>
            </Pressable>
            <View style={styles.headerSpacer} />
          </View>
          <Text style={styles.pageTitle}>{t("themes.title")}</Text>
          <Text style={styles.subtitle}>{t("themes.subtitle")}</Text>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t("themes.searchPlaceholder")}
          />
        </>
      }
      headerStyle={styles.headerBlock}
    >
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 88 },
        ]}
      >
        {isLoading ? (
          <LoadingPlaceholder padding="lg" style={styles.center} />
        ) : themes.length === 0 ? (
          <Text style={styles.empty}>{t("themes.empty")}</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>
            {t("categories.selectNotFound", { query: query.trim() })}
          </Text>
        ) : (
          filtered.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({ pathname: "/themes/[id]", params: { id: item.id } } as Href)
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.cardBody}>
                <CategoryTitle
                  name={item.name}
                  iconSvg={item.iconSvg}
                  iconSize={22}
                  color={theme.appText}
                  nameSize={18}
                  nameWeight="700"
                />
                <Text style={styles.cardMeta}>
                  {t("themes.meta", {
                    words: item.wordCount,
                    questions: item.questionCount ?? 0,
                  })}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.appTextMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => {
          setName("");
          setIconSvg("");
          setPickerIds(new Set());
          setShowCreate(true);
        }}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 16 },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Plus size={18} color="#fff" />
        <Text style={styles.fabText}>{t("themes.newTheme")}</Text>
      </Pressable>

      <SlideUpModal
        visible={showCreate && !showPicker}
        onClose={closeCreateModal}
        title={t("themes.newTheme")}
        keyboardAware
      >
        <View style={styles.modalBody}>
          <Text style={styles.fieldLabel}>{t("themes.nameLabel")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("themes.namePlaceholder")}
            placeholderTextColor={theme.appTextMuted}
            style={styles.input}
          />
          <CategoryIconField
            value={iconSvg}
            onChange={setIconSvg}
            namespace="themes"
          />
          <Pressable
            onPress={() => setShowPicker(true)}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>
              {t("themes.pickWordsOptional")} ({pickerIds.size})
            </Text>
          </Pressable>
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeCreateModal}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleCreate()}
              disabled={!name.trim() || saving}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!name.trim() || saving) && styles.disabledBtn,
                pressed && name.trim() && !saving ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.primaryBtnText}>{t("common.add")}</Text>
            </Pressable>
          </View>
        </View>
      </SlideUpModal>

      <WordPickerSheet
        visible={showPicker}
        words={words}
        selectedIds={pickerIds}
        onToggle={(wid) => {
          setPickerIds((prev) => {
            const next = new Set(prev);
            if (next.has(wid)) next.delete(wid);
            else next.add(wid);
            return next;
          });
        }}
        onClose={() => setShowPicker(false)}
        title={t("themes.pickWords")}
      />
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    headerBlock: {
      gap: 8,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 29,
    },
    headerSpacer: { width: 36, height: 36 },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 4,
      marginLeft: -4,
    },
    backTitle: navBackTitleStyle(theme, colorScheme),
    pageTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.appText,
    },
    subtitle: {
      fontSize: 14,
      color: theme.appTextSecondary,
      marginBottom: 4,
    },
    listContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.appSurface,
      borderWidth: 1,
      borderColor: theme.appBorder,
      borderRadius: 16,
      padding: 16,
    },
    cardBody: { flex: 1, minWidth: 0, gap: 4 },
    cardMeta: { fontSize: 12, color: theme.appTextMuted, marginLeft: 30 },
    center: { paddingVertical: 48, alignItems: "center" },
    empty: {
      textAlign: "center",
      color: theme.appTextMuted,
      paddingVertical: 48,
      fontSize: 14,
    },
    fab: {
      position: "absolute",
      right: 24,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.main500,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: theme.main600,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    modalBody: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 4,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.appText,
      backgroundColor: theme.appMuted,
      marginBottom: 4,
    },
    outlineBtn: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 4,
    },
    outlineBtnText: { fontSize: 14, fontWeight: "600", color: theme.appTextSecondary },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelBtnText: { fontSize: 14, fontWeight: "600", color: theme.appTextSecondary },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    disabledBtn: { opacity: 0.4 },
  });
}
