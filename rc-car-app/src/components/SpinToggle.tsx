import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

interface SpinToggleProps {
  on: boolean;
  /** True once the server has confirmed the current spin state. */
  confirmed: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function SpinToggle({ on, confirmed, disabled, onToggle }: SpinToggleProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [on, rotation]);

  const status = on ? (confirmed ? 'Spinning \u2014 tap to stop' : 'Starting spin\u2026') : 'Tap to spin in place';

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        on && styles.cardOn,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel="Spin"
      accessibilityHint={status}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          on && styles.iconWrapOn,
          { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      >
        <MaterialCommunityIcons name="rotate-right" size={24} color={on ? colors.white : colors.primary} />
      </Animated.View>
      <View style={styles.text}>
        <Text style={[styles.title, on && styles.titleOn]}>Spin</Text>
        <Text style={[styles.subtitle, on && styles.subtitleOn]}>{status}</Text>
      </View>
      <View style={[styles.badge, on ? styles.badgeOn : styles.badgeOff]}>
        <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{on ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  titleOn: { color: colors.white },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  subtitleOn: { color: 'rgba(255,255,255,0.9)' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeOff: { backgroundColor: colors.surface },
  badgeOn: { backgroundColor: colors.white },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8 },
  badgeTextOn: { color: colors.primary },
});
