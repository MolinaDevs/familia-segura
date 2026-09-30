import { Icon } from '@/components/Icon';
import React, { useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BreathingEmblem, Logo } from '@/components/brand/Logo';
import { BrandBackground } from '@/components/brand/BrandBackground';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Icon>['name'];

// No navegador, o foco já aparece na borda azul do campo; o contorno padrão ficaria duplicado.
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/** Moldura das telas de conta: fundo da marca, barra com voltar + assinatura, rolagem que respeita o teclado. */
export function AuthShell({ children, onBack, backLabel = 'Voltar' }: PropsWithChildren<{ onBack?: () => void; backLabel?: string }>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? Math.max(insets.top, 24) : insets.top + 8;
  const bottom = Platform.OS === 'web' ? Math.max(insets.bottom, 24) : insets.bottom + 24;
  return (
    <BrandBackground>
      <KeyboardAwareScrollViewCompat
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} hitSlop={10} testID="auth-back"
              style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
              <Icon name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          ) : <View style={styles.back} />}
          <View style={styles.brand} accessible accessibilityLabel="Família Segura">
            <Logo size={30} />
          </View>
          <View style={styles.back} />
        </View>
        {children}
      </KeyboardAwareScrollViewCompat>
    </BrandBackground>
  );
}

/** Cabeçalho alinhado à esquerda: emblema do logo, título em Montserrat, apoio em Nunito Sans. */
export function AuthHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: IconName }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      {icon ? (
        <View style={[styles.headerIcon, { backgroundColor: colors.secondary }]}>
          <Icon name={icon} size={26} color={colors.primary} />
        </View>
      ) : (
        <BreathingEmblem size={84} style={styles.headerMark} />
      )}
      <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Superfície do formulário. A "costura" laranja no topo marca a abertura (não é moldura). */
export function AuthCard({ children }: PropsWithChildren) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={[styles.seam, { backgroundColor: colors.orange }]} />
      {children}
    </View>
  );
}

/** Campo com rótulo em cima, ícone, foco azul, erro embaixo e (senha) botão de mostrar. */
export function AuthField({
  label, icon, error, helper, secure, right, style, ...input
}: TextInputProps & { label: string; icon?: IconName; error?: string | null; helper?: string; secure?: boolean; right?: ReactNode }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? colors.destructive : focused ? colors.primary : colors.input;
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {right}
      </View>
      <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor, borderWidth: focused || error ? 2 : 1 }]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.primary : colors.mutedForeground} /> : null}
        <TextInput
          {...input}
          secureTextEntry={secure && !visible}
          accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={colors.mutedForeground}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, { color: colors.foreground }, WEB_NO_OUTLINE, style]}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} hitSlop={10}
            onPress={() => setVisible((v) => !v)} style={styles.eye}>
            <Icon name={visible ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={13} color={colors.destructive} />
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : helper ? <Text style={[styles.helper, { color: colors.mutedForeground }]}>{helper}</Text> : null}
    </View>
  );
}

/** Botão principal: afunda levemente ao apertar. */
export function AuthButton({ label, onPress, loading, disabled, variant = 'primary', testID }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'quiet' | 'outline'; testID?: string;
}) {
  const colors = useColors();
  const inactive = Boolean(disabled || loading);
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.primary } : { backgroundColor: variant === 'outline' ? colors.card : 'transparent' },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.input },
        inactive && !loading && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? colors.primaryForeground : colors.primary} /> : (
        <Text style={[styles.buttonText, { color: primary ? colors.primaryForeground : variant === 'outline' ? colors.foreground : colors.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function FormMessage({ tone, children }: PropsWithChildren<{ tone: 'error' | 'info' }>) {
  const colors = useColors();
  const error = tone === 'error';
  return (
    <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: error ? colors.dangerSoft : colors.successSoft }]}>
      <Icon name={error ? 'alert-circle' : 'check-circle'} size={16} color={error ? colors.destructive : colors.success} />
      <Text style={[styles.messageText, { color: error ? colors.destructive : colors.success }]}>{children}</Text>
    </View>
  );
}

export function DividerLabel({ children }: PropsWithChildren) {
  const colors = useColors();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{children}</Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Rodapé "Ainda não tem conta? Criar" etc. */
export function AuthSwitch({ question, action, onPress, testID }: { question: string; action: string; onPress: () => void; testID?: string }) {
  const colors = useColors();
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchText, { color: colors.mutedForeground }]}>{question}</Text>
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12} testID={testID}>
        <Text style={[styles.switchLink, { color: colors.primary }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function TrustNote() {
  const colors = useColors();
  return (
    <View style={styles.trust}>
      <Icon name="lock" size={13} color={colors.mutedForeground} />
      <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
        Conexão protegida. Seus dados e os da criança seguem a LGPD e o ECA Digital.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  back: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  header: { marginTop: 20, marginBottom: 22 },
  headerMark: { marginBottom: 14, alignSelf: 'flex-start' },
  headerIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'Montserrat_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'NunitoSans_500Medium', fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 380 },

  card: {
    borderRadius: 24, borderWidth: 1, padding: 20, paddingTop: 24, gap: 18, overflow: 'hidden',
    shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 2,
  },
  seam: { position: 'absolute', top: 0, left: 28, right: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 16, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 50, fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, paddingVertical: 0 },
  eye: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldError: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 12.5, lineHeight: 17 },
  helper: { fontFamily: 'NunitoSans_500Medium', fontSize: 12.5, lineHeight: 17 },

  button: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16, letterSpacing: 0.2 },
  disabled: { opacity: 0.45 },
  // Toque: o botão afunda de leve (confirmação física, sem exagero).
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },

  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14 },
  messageText: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 13.5, lineHeight: 19 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 13 },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24, flexWrap: 'wrap' },
  switchText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  switchLink: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 15 },

  trust: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: 24 },
  trustText: { fontFamily: 'NunitoSans_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 320 },
});
