import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Plus,
  Rows3,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIconField } from "@/components/CategoryIconField";
import { CategoryTitle } from "@/components/CategoryIcon";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { ScreenShell } from "@/components/ScreenShell";
import { SearchBar } from "@/components/SearchBar";
import { SlideUpModal } from "@/components/SlideUpModal";
import { useCategories } from "@/hooks/useCategories";
import { normalizeCategoryLabel } from "@/lib/categoryMatch";
import {
  getCategoryViewLayout,
  setCategoryViewLayout,
  type CategoryViewLayout,
} from "@/lib/categoryView";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";

const LAYOUT_OPTIONS: {
  value: CategoryViewLayout;
  Icon: typeof LayoutList;
  labelKey: "row" | "grid2" | "grid3";
}[] = [
  { value: "row", Icon: LayoutList, labelKey: "row" },
  { value: "grid-2", Icon: Rows3, labelKey: "grid2" },
  { value: "grid-3", Icon: LayoutGrid, labelKey: "grid3" },
];

export default function CategoriesHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { data: categories = [], isLoading, createCategory } = useCategories();

  const [layout, setLayout] = useState<CategoryViewLayout>("row");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [iconSvg, setIconSvg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategoryViewLayout().then(setLayout);
  }, []);

  useEffect(() => {
    void setCategoryViewLayout(layout);
  }, [layout]);

  const filtered = useMemo(() => {
    const q = normalizeCategoryLabel(query);
    if (!q) return categories;
    return categories.filter((c) => normalizeCategoryLabel(c.name).includes(q));
  }, [categories, query]);

  const closeCreateModal = () => {
    setShowCreate(false);
    setName("");
    setIconSvg("");
  };

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const cat = await createCategory({
        name: name.trim(),
        iconSvg: iconSvg.trim() || null,
      });
      closeCreateModal();
      router.push({ pathname: "/categories/[id]", params: { id: String(cat.id) } });
    } finally {
      setSaving(false);
    }
  };

  const navigateToCategory = (id: number) => {
    router.push({ pathname: "/categories/[id]", params: { id: String(id) } } as Href);
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
              <Text style={styles.backTitle}>{t("nav.categories")}</Text>
            </Pressable>
            <View style={styles.layoutToggle}>
              {LAYOUT_OPTIONS.map(({ value, Icon, labelKey }) => {
                const active = layout === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setLayout(value)}
                    accessibilityLabel={t(`categories.view.${labelKey}`)}
                    style={({ pressed }) => [
                      styles.layoutBtn,
                      active && styles.layoutBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Icon
                      size={16}
                      color={active ? theme.main500 : theme.appTextMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.pageTitle}>{t("categories.title")}</Text>
          <Text style={styles.subtitle}>{t("categories.subtitle")}</Text>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t("categories.searchPlaceholder")}
          />
        </>
      }
      headerStyle={styles.headerBlock}
    >
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          layout !== "row" && styles.gridContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 88 },
        ]}
      >
        {isLoading ? (
          <LoadingPlaceholder padding="lg" style={styles.center} />
        ) : categories.length === 0 ? (
          <Text style={styles.empty}>{t("categories.empty")}</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>
            {t("categories.selectNotFound", { query: query.trim() })}
          </Text>
        ) : layout === "row" ? (
          filtered.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => navigateToCategory(category.id)}
              style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.cardBody}>
                <CategoryTitle
                  name={category.name}
                  iconSvg={category.iconSvg}
                  iconSize={22}
                  color={theme.appText}
                  nameSize={18}
                  nameWeight="700"
                />
                <Text style={styles.cardMeta}>
                  {t("categories.wordCount", { count: category.wordCount })}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.appTextMuted} />
            </Pressable>
          ))
        ) : (
          <View style={styles.gridWrap}>
            {filtered.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => navigateToCategory(category.id)}
                style={({ pressed }) => [
                  styles.gridCard,
                  layout === "grid-3" && styles.gridCardSmall,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <CategoryTitle
                  name={category.name}
                  iconSvg={category.iconSvg}
                  iconSize={layout === "grid-3" ? 16 : 18}
                  color={theme.appText}
                  nameSize={layout === "grid-3" ? 14 : 16}
                  nameWeight="700"
                />
                <Text style={styles.gridMeta}>
                  {t("categories.wordCount", { count: category.wordCount })}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowCreate(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 16 },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Plus size={18} color="#fff" />
        <Text style={styles.fabText}>{t("categories.newCategory")}</Text>
      </Pressable>

      <SlideUpModal
        visible={showCreate}
        onClose={closeCreateModal}
        title={t("categories.newCategory")}
        keyboardAware
      >
        <View style={styles.modalBody}>
          <Text style={styles.fieldLabel}>{t("categories.nameLabel")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("categories.namePlaceholder")}
            placeholderTextColor={theme.appTextMuted}
            style={styles.input}
          />
          <CategoryIconField value={iconSvg} onChange={setIconSvg} />
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeCreateModal}
              style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.outlineBtnText}>{t("common.cancel")}</Text>
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
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, marginLeft: -4 },
    backTitle: navBackTitleStyle(theme, colorScheme),
    layoutToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: theme.appBorder,
      backgroundColor: theme.appMuted,
      borderRadius: 12,
      padding: 2,
    },
    layoutBtn: {
      borderRadius: 8,
      padding: 6,
    },
    layoutBtnActive: {
      backgroundColor: theme.appSurface,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    pageTitle: { fontSize: 20, fontWeight: "700", color: theme.appText },
    subtitle: { fontSize: 14, color: theme.appTextSecondary, marginBottom: 4 },
    listContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
    gridContent: { paddingTop: 16 },
    gridWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    rowCard: {
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
    gridCard: {
      width: "48%",
      minHeight: 88,
      backgroundColor: theme.appSurface,
      borderWidth: 1,
      borderColor: theme.appBorder,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    gridCardSmall: { width: "31%" },
    gridMeta: { fontSize: 11, color: theme.appTextMuted, marginTop: "auto" },
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
      gap: 8,
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
      backgroundColor: theme.appSurface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.appText,
      marginBottom: 4,
    },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    outlineBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    outlineBtnText: { fontSize: 14, fontWeight: "600", color: theme.appTextSecondary },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    disabledBtn: { opacity: 0.4 },
  });
}
