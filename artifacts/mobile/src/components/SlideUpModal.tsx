import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_DRAG = 72;
const DISMISS_VELOCITY = 900;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxHeight?: ViewStyle["maxHeight"];
  bottomInset?: number;
  /** Overlay inside parent (e.g. above SRS rating bar) instead of RN Modal. */
  inline?: boolean;
  scrollable?: boolean;
  /** Give the sheet an explicit height (from maxHeight) so flex children can fill it. */
  expanded?: boolean;
  /** Move the sheet above the software keyboard (for forms with inputs). */
  keyboardAware?: boolean;
};

function resolveSheetHeight(
  maxHeight: ViewStyle["maxHeight"],
  bottomInset: number,
): number | undefined {
  const available = SCREEN_HEIGHT - bottomInset;
  if (typeof maxHeight === "string" && maxHeight.endsWith("%")) {
    const pct = parseFloat(maxHeight) / 100;
    if (!Number.isNaN(pct)) return available * pct;
  }
  if (typeof maxHeight === "number") return maxHeight;
  return undefined;
}

export function SlideUpModal({
  visible,
  onClose,
  children,
  title,
  maxHeight = "85%",
  bottomInset = 0,
  inline = false,
  scrollable = false,
  expanded = false,
  keyboardAware = false,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);

  const sheetPixelHeight = resolveSheetHeight(maxHeight, bottomInset);

  const finishHide = useCallback(() => {
    setMounted(false);
  }, []);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 320 });
  }, [backdropOpacity, translateY]);

  const animateOut = useCallback(
    (after?: () => void) => {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 260 }, (done) => {
        if (done) {
          runOnJS(finishHide)();
          if (after) runOnJS(after)();
        }
      });
    },
    [backdropOpacity, finishHide, translateY],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => animateIn());
    } else if (mounted) {
      animateOut();
    }
  }, [visible, mounted, animateIn, animateOut]);

  useEffect(() => {
    if (!keyboardAware || !mounted) return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (event) => {
      keyboardOffset.value = withTiming(event.endCoordinates.height, {
        duration: event.duration ?? 250,
      });
    });
    const onHide = Keyboard.addListener(hideEvent, (event) => {
      keyboardOffset.value = withTiming(0, {
        duration: Platform.OS === "ios" ? (event.duration ?? 250) : 220,
      });
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [keyboardAware, mounted, keyboardOffset]);

  useEffect(() => {
    if (!visible) {
      keyboardOffset.value = 0;
    }
  }, [visible, keyboardOffset]);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DRAG || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withTiming(0, { duration: 220 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sheetHostStyle = useAnimatedStyle(() => ({
    bottom: bottomInset + keyboardOffset.value,
  }));

  if (!mounted) return null;

  const body = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="never"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={expanded ? styles.bodyExpanded : styles.body}>{children}</View>
  );

  const sheet = (
    <Animated.View
      style={[
        styles.sheet,
        sheetStyle,
        expanded && sheetPixelHeight != null
          ? { height: sheetPixelHeight }
          : sheetPixelHeight != null
            ? { maxHeight: sheetPixelHeight }
            : { maxHeight },
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.handleArea}>
          <Pressable onPress={requestClose} style={styles.handlePress}>
            <View style={styles.handle} />
          </Pressable>
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      </GestureDetector>
      {body}
    </Animated.View>
  );

  const backdrop = (
    <Animated.View
      style={[
        styles.backdrop,
        backdropStyle,
        bottomInset > 0 && { bottom: bottomInset },
      ]}
      pointerEvents="auto"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
    </Animated.View>
  );

  if (inline) {
    return (
      <View style={styles.inlineRoot} pointerEvents="box-none">
        {backdrop}
        <View
          style={[styles.inlineSheetHost, { bottom: bottomInset }]}
          pointerEvents="box-none"
        >
          {sheet}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.modalRoot}>
        {backdrop}
        <Animated.View
          style={[
            styles.sheetHost,
            bottomInset > 0 && !keyboardAware ? { bottom: bottomInset } : null,
            keyboardAware ? sheetHostStyle : null,
          ]}
          pointerEvents="box-none"
        >
          {sheet}
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    inlineRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheetHost: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    inlineSheetHost: {
      position: "absolute",
      left: 0,
      right: 0,
    },
    sheet: {
      backgroundColor: theme.appSurface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      overflow: "hidden",
    },
    handleArea: {
      paddingBottom: 4,
    },
    handlePress: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.appBorderStrong,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.appText,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    body: {
      flexShrink: 1,
    },
    bodyExpanded: {
      flex: 1,
      minHeight: 0,
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    scrollContent: {
      paddingBottom: 8,
    },
  });
}
