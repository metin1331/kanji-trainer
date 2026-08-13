import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { CategoryIcon } from "./CategoryIcon";

type Props = {
  value: string;
  onChange: (value: string) => void;
  namespace?: "categories" | "themes";
};

export function CategoryIconField({
  value,
  onChange,
  namespace = "categories",
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {t(`${namespace}.iconLabel`)}{" "}
        <Text style={styles.optional}>{t(`${namespace}.iconOptional`)}</Text>
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t(`${namespace}.iconPlaceholder`)}
        placeholderTextColor={theme.appTextMuted}
        multiline
        textAlignVertical="top"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.trim() ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>{t(`${namespace}.iconPreview`)}</Text>
          <CategoryIcon svg={value} size={24} color={theme.appText} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 6,
    },
    optional: {
      textTransform: "none",
      fontWeight: "400",
    },
    input: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      backgroundColor: theme.appSurface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 12,
      fontFamily: "monospace",
      color: theme.appText,
    },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.appBorder,
      borderRadius: 12,
      backgroundColor: theme.appMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    previewLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.appTextMuted,
    },
  });
}
