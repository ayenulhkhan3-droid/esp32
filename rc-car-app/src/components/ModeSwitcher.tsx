import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ControlMode } from '../types/commands';
import { colors, radius } from '../theme';

const MODES: { mode: ControlMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'joystick', label: 'Joystick', icon: 'game-controller-outline' },
  { mode: 'voice', label: 'Voice', icon: 'mic-outline' },
];

interface ModeSwitcherProps {
  mode: ControlMode;
  onChange: (mode: ControlMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ mode, onChange, disabled }: ModeSwitcherProps) {
  const [width, setWidth] = useState(0);
  const index = MODES.findIndex((m) => m.mode === mode);
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: index, useNativeDriver: true, friction: 8, tension: 90 }).start();
  }, [index, slide]);

  const segment = width > 0 ? (width - 8) / MODES.length : 0;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segment,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }],
            },
          ]}
        />
      ) : null}
      {MODES.map((m) => {
        const selected = m.mode === mode;
        return (
          <Pressable
            key={m.mode}
            style={styles.tab}
            onPress={() => !selected && onChange(m.mode)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${m.label} mode`}
          >
            <Ionicons name={m.icon} size={18} color={selected ? colors.white : colors.textMuted} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  tab: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  labelSelected: { color: colors.white },
});
