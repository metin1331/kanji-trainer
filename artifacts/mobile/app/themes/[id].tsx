import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Eye, Pencil, Play, Plus, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIconField } from "@/components/CategoryIconField";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { SlideUpModal } from "@/components/SlideUpModal";
import { WordListPanel } from "@/components/WordListPanel";
import { WordPickerSheet } from "@/components/WordPickerSheet";
import type { WordFormSaveData } from "@/components/WordFormModal";
import { confirmAsync } from "@/lib/confirm";
import { useTheme } from "@/hooks/useThemes";
import { useWords } from "@/hooks/useWords";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme as useAppTheme } from "@/theme/ThemeProvider";

function ToolbarButton({
  onPress,
  disabled,
  label,
  icon,
  primary,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  const { theme } = useAppTheme();
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
          borderWidth: primary ? 0 : 1,
          borderColor: theme.appBorderStrong,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: primary ? theme.main500 : "transparent",
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

export default function ThemeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme: colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { words, updateWord, deleteWord } = useWords();
  const {
    theme: themeData,
    isLoading,
    isError,
    updateTheme,
    deleteTheme,
    addThemeWords,
    removeThemeWord,
    isSaving,
  } = useTheme(themeId);

  const [showEdit, setShowEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [iconDraft, setIconDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerIds, setPickerIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (themeData) {
      setNameDraft(themeData.name);
      setIconDraft((themeData as { iconSvg?: string | null }).iconSvg ?? "");
    }
  }, [themeData]);

  const themeWords = useMemo(() => {
    if (!themeData) return [];
    const map = new Map(words.map((w) => [w.id, w]));
    return themeData.wordIds
      .map((wid) => map.get(wid))
      .filter((w): w is NonNullable<typeof w> => !!w);
  }, [themeData, words]);

  const closeEditModal = () => {
    setShowEdit(false);
    if (themeData) {
      setNameDraft(themeData.name);
      setIconDraft((themeData as { iconSvg?: string | null }).iconSvg ?? "");
    }
  };

  const handleSave = async () => {
    if (!nameDraft.trim() || saving) return;
    setSaving(true);
    try {
      await updateTheme({
        name: nameDraft.trim(),
        iconSvg: iconDraft.trim() || null,
      });
      closeEditModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTheme = async () => {
    const ok = await confirmAsync(
      t("common.confirmTitle"),
      t("themes.confirmDelete"),
      t("common.delete"),
      t("common.cancel"),
    );
    if (!ok) return;
    await deleteTheme();
    router.replace("/themes" as Href);
  };

  const handleAddWords = async () => {
    const newIds = [...pickerIds].filter(
      (wid) => !themeData?.wordIds.includes(wid),
    );
    if (newIds.length > 0) await addThemeWords(newIds);
    setShowPicker(false);
    setPickerIds(new Set());
  };

  const handleBulkRemove = async (ids: number[]) => {
    await Promise.all(ids.map((wordId) => removeThemeWord(wordId)));
  };

  const handleEditSave = (wordId: number, data: WordFormSaveData) => {
    updateWord(wordId, {
      kanji: data.kanji,
      pronunciation: data.pronunciation,
      meaning: data.meaning,
      description: data.description,
      level: data.level,
      starred: data.starred,
      pronLevel: data.pronLevel,
      pronStarred: data.pronStarred,
      meaningLevel: data.meaningLevel,
      meaningStarred: data.meaningStarred,
      jlptLevel: data.jlptLevel,
      date: data.date,
      srsExamples: data.srsExamples,
      categoryIds: data.categoryIds,
    });
  };

  if (isLoading || !themeData) {
    return <LoadingPlaceholder padding="lg" style={styles.center} />;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t("themes.loadError")}</Text>
      </View>
    );
  }

  const iconSvg = (themeData as { iconSvg?: string | null }).iconSvg;
  const questionCount = themeData.questions?.length ?? 0;

  const toolbarExtra = (
    <>
      <ToolbarButton
        label={t("themes.addWords")}
        onPress={() => {
          setPickerIds(new Set(themeData.wordIds));
          setShowPicker(true);
        }}
        icon={<Plus size={13} color={colors.appTextSecondary} strokeWidth={2} />}
      />
      <ToolbarButton
        label={t("themeQuiz.edit")}
        onPress={() => router.push(`/themes/${themeId}/quiz/edit` as Href)}
        icon={<Eye size={13} color={colors.appTextSecondary} strokeWidth={2} />}
      />
      <ToolbarButton
        label={t("themeQuiz.start")}
        primary
        disabled={questionCount === 0}
        onPress={() => router.push(`/themes/${themeId}/quiz` as Href)}
        icon={<Play size={13} color="#fff" strokeWidth={2} />}
      />
    </>
  );

  return (
    <View style={styles.wrap}>
      <WordListPanel
        title={themeData.name}
        iconSvg={iconSvg}
        onBack={() => router.back()}
        prefsScope={`theme-${themeId}`}
        words={themeWords}
        allWords={words}
        isLoading={false}
        isError={false}
        emptyMessage={t("themes.noWords")}
        studyTitle={t("themes.studyTitle", { name: themeData.name })}
        studyReturnPath={`/themes/${themeId}`}
        onUpdate={updateWord}
        onDelete={deleteWord}
        onEditSave={handleEditSave}
        toolbarExtra={toolbarExtra}
        bulkMode="remove"
        onBulkRemove={handleBulkRemove}
        bulkRemoveLabel={t("themes.removeFromTheme")}
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
        <Text style={styles.editFabText}>{t("themes.editTheme")}</Text>
      </Pressable>

      <SlideUpModal
        visible={showEdit}
        onClose={closeEditModal}
        title={t("themes.editTheme")}
        keyboardAware
      >
        <View style={styles.modalBody}>
          <Text style={styles.fieldLabel}>{t("themes.nameLabel")}</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder={t("themes.namePlaceholder")}
            placeholderTextColor={colors.appTextMuted}
            style={styles.input}
          />
          <CategoryIconField
            value={iconDraft}
            onChange={setIconDraft}
            namespace="themes"
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeEditModal}
              style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.outlineBtnText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={!nameDraft.trim() || saving || isSaving}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!nameDraft.trim() || saving || isSaving) && styles.disabledBtn,
                pressed && nameDraft.trim() && !saving && !isSaving ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.primaryBtnText}>{t("common.update")}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void handleDeleteTheme()}
            disabled={saving || isSaving}
            style={({ pressed }) => [
              styles.deleteBtn,
              (saving || isSaving) && styles.disabledBtn,
              pressed && !saving && !isSaving ? { opacity: 0.85 } : null,
            ]}
          >
            <Trash2 size={16} color={colors.danger} />
            <Text style={styles.deleteBtnText}>{t("themes.deleteTheme")}</Text>
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
        title={t("themes.addWords")}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.appBg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    deleteBtn: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: "#fecaca",
      borderRadius: 12,
      paddingVertical: 12,
    },
    deleteBtnText: { color: theme.danger, fontSize: 14, fontWeight: "600" },
  });
}
