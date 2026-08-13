import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  BookOpen,
  FileText,
  Languages,
  Pencil,
  PenTool,
  Plus,
  Trash2,
  Waves,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CategoryIconField } from "@/components/CategoryIconField";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { SlideUpModal } from "@/components/SlideUpModal";
import { WordListPanel } from "@/components/WordListPanel";
import { WordPickerSheet } from "@/components/WordPickerSheet";
import type { WordFormSaveData } from "@/components/WordFormModal";
import { confirmAsync } from "@/lib/confirm";
import { useCategory } from "@/hooks/useCategories";
import { fetchSrsQueue } from "@/hooks/useSrs";
import { useWords } from "@/hooks/useWords";
import { srsDeckLabel } from "@/i18n/srsDeckLabels";
import { useTranslation } from "@/i18n/I18nProvider";
import { startSrsSession } from "@/lib/srsStore";
import { useTheme } from "@/theme/ThemeProvider";
import type { SrsDeckType } from "@/types/srs";

const SRS_DECKS: { deck: SrsDeckType; Icon: typeof Languages }[] = [
  { deck: "word", Icon: Languages },
  { deck: "pronunciation", Icon: Waves },
  { deck: "meaning", Icon: BookOpen },
  { deck: "example", Icon: FileText },
  { deck: "drawing", Icon: PenTool },
];

function ToolbarButton({
  onPress,
  disabled,
  label,
  icon,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  icon: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderWidth: 1,
          borderColor: theme.appBorderStrong,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { words, updateWord, deleteWord } = useWords();
  const {
    data: category,
    isLoading,
    isError,
    updateCategory,
    deleteCategory,
    setCategoryWords,
  } = useCategory(categoryId);

  const [showEdit, setShowEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [iconDraft, setIconDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerIds, setPickerIds] = useState<Set<number>>(() => new Set());
  const [startingDeck, setStartingDeck] = useState<SrsDeckType | null>(null);

  useEffect(() => {
    if (category) {
      setNameDraft(category.name);
      setIconDraft(category.iconSvg ?? "");
    }
  }, [category]);

  const categoryWords = useMemo(() => {
    if (!category) return [];
    const map = new Map(words.map((w) => [w.id, w]));
    return category.wordIds
      .map((wid) => map.get(wid))
      .filter((w): w is NonNullable<typeof w> => !!w);
  }, [category, words]);

  const closeEditModal = () => {
    setShowEdit(false);
    if (category) {
      setNameDraft(category.name);
      setIconDraft(category.iconSvg ?? "");
    }
  };

  const handleSave = async () => {
    if (!nameDraft.trim() || saving) return;
    setSaving(true);
    try {
      await updateCategory({
        name: nameDraft.trim(),
        iconSvg: iconDraft.trim() || null,
      });
      closeEditModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    const ok = await confirmAsync(
      t("common.confirmTitle"),
      t("categories.confirmDelete"),
      t("common.delete"),
      t("common.cancel"),
    );
    if (!ok) return;
    await deleteCategory();
    router.replace("/categories" as Href);
  };

  const handleAddWords = async () => {
    if (!category) return;
    await setCategoryWords([...pickerIds]);
    setShowPicker(false);
    setPickerIds(new Set());
  };

  const startCategorySrs = async (deck: SrsDeckType) => {
    if (!category || category.wordIds.length === 0) {
      Alert.alert(t("common.confirmTitle"), t("categories.noWordsInCategory"));
      return;
    }
    setStartingDeck(deck);
    try {
      let items = await fetchSrsQueue(deck, {
        wordIds: category.wordIds,
        sort: "due-asc",
      });
      if (deck === "drawing") {
        items = items.filter((item) => /[\u4e00-\u9fff]/.test(item.word.kanji));
      }
      if (items.length === 0) {
        Alert.alert(t("common.confirmTitle"), t("categories.noSrsCards"));
        return;
      }
      const label = srsDeckLabel(t, deck);
      startSrsSession(
        deck,
        items,
        t("categories.srsSessionTitle", {
          category: category.name,
          deck: label.title,
        }),
        `/categories/${categoryId}`,
        { jlptLevels: [], sort: "due-asc" },
      );
      router.push("/srs/study" as Href);
    } finally {
      setStartingDeck(null);
    }
  };

  const handleEditSave = (wordId: number, data: WordFormSaveData) => {
    updateWord(wordId, {
      ...data,
      relatedWordIds: words.find((w) => w.id === wordId)?.relatedWordIds ?? [],
      categoryIds: data.categoryIds,
    });
  };

  if (isLoading || !category) {
    return (
      <LoadingPlaceholder padding="lg" style={[styles.center, { backgroundColor: theme.appSurface, flex: 1 }]} />
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.appSurface, flex: 1 }]}>
        <Text style={styles.error}>{t("categories.loadError")}</Text>
      </View>
    );
  }

  const toolbarExtra = (
    <>
      <ToolbarButton
        label={t("categories.addWords")}
        onPress={() => {
          setPickerIds(new Set(category.wordIds));
          setShowPicker(true);
        }}
        icon={<Plus size={13} color={theme.appTextSecondary} strokeWidth={2} />}
      />
      {SRS_DECKS.map(({ deck, Icon }) => {
        const label = srsDeckLabel(t, deck);
        return (
          <ToolbarButton
            key={deck}
            label={label.title}
            disabled={startingDeck !== null || category.wordIds.length === 0}
            onPress={() => void startCategorySrs(deck)}
            icon={
              startingDeck === deck ? (
                <LoadingSpinner size={13} color={theme.appTextSecondary} />
              ) : (
                <Icon size={13} color={theme.appTextSecondary} strokeWidth={1.8} />
              )
            }
          />
        );
      })}
    </>
  );

  return (
    <View style={styles.wrap}>
      <WordListPanel
        title={category.name}
        iconSvg={category.iconSvg}
        toolbarExtra={toolbarExtra}
        onBack={() => router.back()}
        prefsScope={`/categories/${categoryId}`}
        words={categoryWords}
        allWords={words}
        isLoading={false}
        isError={false}
        mode="words"
        emptyMessage={t("categories.noWordsInCategory")}
        onUpdate={updateWord}
        onDelete={deleteWord}
        onEditSave={handleEditSave}
        studyTitle={category.name}
        studyReturnPath={`/categories/${categoryId}`}
      />

      <Pressable
        onPress={() => setShowEdit(true)}
        style={({ pressed }) => [
          styles.editFab,
          { bottom: Math.max(insets.bottom, 16) + 16 },
          pressed && { opacity: 0.9 },
        ]}
      >
        <Pencil size={18} color="#fff" />
        <Text style={styles.editFabText}>{t("categories.editCategory")}</Text>
      </Pressable>

      <SlideUpModal
        visible={showEdit}
        onClose={closeEditModal}
        title={t("categories.editCategory")}
        maxHeight="75%"
      >
        <View style={styles.modalBody}>
          <Text style={styles.fieldLabel}>{t("categories.nameLabel")}</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder={t("categories.namePlaceholder")}
            placeholderTextColor={theme.appTextMuted}
            style={styles.input}
          />
          <CategoryIconField value={iconDraft} onChange={setIconDraft} />
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeEditModal}
              style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.outlineBtnText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={!nameDraft.trim() || saving}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!nameDraft.trim() || saving) && styles.disabledBtn,
                pressed && nameDraft.trim() && !saving ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.primaryBtnText}>{t("common.update")}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void handleDeleteCategory()}
            disabled={saving}
            style={({ pressed }) => [
              styles.deleteBtn,
              saving && styles.disabledBtn,
              pressed && !saving ? { opacity: 0.85 } : null,
            ]}
          >
            <Trash2 size={16} color="#ef4444" />
            <Text style={styles.deleteBtnText}>{t("categories.deleteCategory")}</Text>
          </Pressable>
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
        onClose={() => {
          setShowPicker(false);
          setPickerIds(new Set());
        }}
        onConfirm={() => void handleAddWords()}
        title={t("categories.addWords")}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.appBg },
    center: { alignItems: "center", justifyContent: "center" },
    error: { color: theme.danger, fontSize: 14 },
    editFab: {
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
      zIndex: 20,
    },
    editFabText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
    modalActions: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 },
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
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: "#fecaca",
      borderRadius: 12,
      paddingVertical: 12,
    },
    deleteBtnText: { color: "#ef4444", fontSize: 14, fontWeight: "600" },
  });
}
