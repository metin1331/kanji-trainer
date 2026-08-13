import { Text, View, type TextStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { prepareCategoryIconSvg } from "@/lib/categoryIconSvg";
import { useTheme } from "@/theme/ThemeProvider";
import { backTitleColor, navBackTitleStyle } from "@/theme/screenNavStyles";

type IconProps = {
  svg?: string | null;
  size?: number;
  color?: string;
};

export function CategoryIcon({ svg, size = 20, color }: IconProps) {
  if (!svg?.trim()) return null;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SvgXml
        xml={prepareCategoryIconSvg(svg)}
        width={size}
        height={size}
        color={color}
      />
    </View>
  );
}

type TitleProps = {
  name: string;
  iconSvg?: string | null;
  iconSize?: number;
  color?: string;
  nameSize?: number;
  nameWeight?: "600" | "700";
  /** Nav back row: uppercase label styling with theme-aware accent color. */
  tone?: "default" | "nav";
};

export function CategoryTitle({
  name,
  iconSvg,
  iconSize = 20,
  color,
  nameSize = 12,
  nameWeight = "700",
  tone = "default",
}: TitleProps) {
  const { theme, colorScheme } = useTheme();
  const resolvedColor =
    color ?? (tone === "nav" ? backTitleColor(theme, colorScheme) : theme.appText);

  const nameStyle: TextStyle =
    tone === "nav"
      ? navBackTitleStyle(theme, colorScheme, { flexShrink: 1 })
      : {
          fontSize: nameSize,
          fontWeight: nameWeight,
          color: resolvedColor,
          flexShrink: 1,
        };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
      <CategoryIcon svg={iconSvg} size={iconSize} color={resolvedColor} />
      <Text style={nameStyle} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}
