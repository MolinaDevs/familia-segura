import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

/** Tela padrão: rolagem, margens seguras, título e (opcional) botão de voltar. */
export function Screen({
  title, eyebrow, subtitle, back, right, children, tabs, refreshing, onRefresh,
}: PropsWithChildren<{
  title?: string; eyebrow?: string; subtitle?: string; back?: boolean; right?: ReactNode; tabs?: boolean;
  refreshing?: boolean; onRefresh?: () => void;
}>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12,
        paddingBottom: Platform.OS === 'web' ? 118 : insets.bottom + (tabs ? 100 : 32),
      }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {(back || right) && (
        <View style={styles.nav}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} hitSlop={10}
              style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          ) : <View />}
          {right}
        </View>
      )}
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text> : null}
      {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text> : null}
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, testID }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }>) {
  const colors = useColors();
  const base = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style];
  if (!onPress) return <View testID={testID} style={base}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [...base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label, onPress, variant = 'primary', icon, loading, disabled, testID, style,
}: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'; icon?: IconName;
  loading?: boolean; disabled?: boolean; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    secondary: { bg: colors.card, fg: colors.foreground, border: colors.border },
    destructive: { bg: colors.dangerSoft, fg: colors.destructive, border: colors.dangerSoft },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : 1 }, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon ? <Feather name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color, testID }: { label: string; selected?: boolean; onPress?: () => void; color?: string; testID?: string }) {
  const colors = useColors();
  const tint = color ?? colors.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? tint : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
    >
      <Text style={[styles.chipText, { color: selected ? tint : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({
  icon, iconColor, title, detail, right, onPress, testID, destructive,
}: {
  icon?: IconName; iconColor?: string; title: string; detail?: string; right?: ReactNode; onPress?: () => void; testID?: string; destructive?: boolean;
}) {
  const colors = useColors();
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
          <Feather name={icon} size={18} color={destructive ? colors.destructive : iconColor ?? colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: destructive ? colors.destructive : colors.foreground }]}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null)}
    </>
  );
  if (!onPress) return <View testID={testID} style={styles.row}>{content}</View>;
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>;
}

export function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

export function SectionTitle({ children, action, onAction }: PropsWithChildren<{ action?: string; onAction?: () => void }>) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{children}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}><Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text></Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, detail, action }: { icon: IconName; title: string; detail?: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon} size={28} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {detail ? <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
      {action}
    </View>
  );
}

export function Notice({ icon = 'info', tone = 'neutral', children }: PropsWithChildren<{ icon?: IconName; tone?: 'neutral' | 'warning' | 'danger' | 'success' }>) {
  const colors = useColors();
  const palette = {
    neutral: { bg: colors.secondary, fg: colors.secondaryForeground },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.destructive },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Feather name={icon} size={18} color={palette.fg} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1.2, marginBottom: 4, textTransform: 'uppercase' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -1 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, marginTop: 8 },
  card: { borderRadius: 22, borderWidth: 1, padding: 18 },
  button: { minHeight: 50, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 56 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  rowDetail: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  divider: { height: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  empty: { borderRadius: 22, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center' },
  emptyDetail: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
