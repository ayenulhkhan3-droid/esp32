import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export type ConnectionStatus = 'checking' | 'online' | 'error' | 'offline';

const META: Record<ConnectionStatus, { label: string; color: string; bg: string }> = {
  checking: { label: 'Checking\u2026', color: colors.warning, bg: colors.warningSoft },
  online: { label: 'Connected', color: colors.success, bg: colors.successSoft },
  error: { label: 'Server error', color: colors.danger, bg: colors.dangerSoft },
  offline: { label: 'No internet', color: colors.danger, bg: colors.dangerSoft },
};

export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const meta = META[status];

  useEffect(() => {
    if (status !== 'online') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  return (
    <View
      style={[styles.pill, { backgroundColor: meta.bg }]}
      accessibilityRole="text"
      accessibilityLabel={`Connection: ${meta.label}`}
    >
      <Animated.View style={[styles.dot, { backgroundColor: meta.color, opacity: pulse }]} />
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '700' },
});
