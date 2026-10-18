import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { JoystickDirection } from '../types/commands';
import { colors } from '../theme';

interface JoystickProps {
  size: number;
  disabled?: boolean;
  disabledLabel?: string;
  /** Called only when the direction changes; null means the stick is centred. */
  onDirectionChange: (direction: JoystickDirection | null) => void;
  /** Called every time the finger lifts or the gesture is interrupted. */
  onRelease: () => void;
}

const DEAD_ZONE = 0.3;
const HYSTERESIS_DEG = 12;

const SECTOR_CENTER: Record<JoystickDirection, number> = {
  right: 0,
  forward: 90,
  left: 180,
  backward: -90,
};

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function resolveDirection(
  x: number,
  y: number,
  maxTravel: number,
  current: JoystickDirection | null,
): JoystickDirection | null {
  const distance = Math.hypot(x, y);
  const deadZone = maxTravel * DEAD_ZONE * (current ? 0.8 : 1);
  if (distance < deadZone) return null;

  const angle = (Math.atan2(-y, x) * 180) / Math.PI;
  if (current && angularDistance(angle, SECTOR_CENTER[current]) <= 45 + HYSTERESIS_DEG) {
    return current;
  }
  let best: JoystickDirection = 'forward';
  let bestDistance = Infinity;
  (Object.keys(SECTOR_CENTER) as JoystickDirection[]).forEach((dir) => {
    const d = angularDistance(angle, SECTOR_CENTER[dir]);
    if (d < bestDistance) {
      best = dir;
      bestDistance = d;
    }
  });
  return best;
}

const ARROWS: { dir: JoystickDirection; icon: keyof typeof Ionicons.glyphMap; style: object }[] = [
  { dir: 'forward', icon: 'chevron-up', style: { top: 10, alignSelf: 'center' } },
  { dir: 'backward', icon: 'chevron-down', style: { bottom: 10, alignSelf: 'center' } },
  { dir: 'left', icon: 'chevron-back', style: { left: 10, top: '50%', marginTop: -14 } },
  { dir: 'right', icon: 'chevron-forward', style: { right: 10, top: '50%', marginTop: -14 } },
];

export function Joystick({ size, disabled = false, disabledLabel, onDirectionChange, onRelease }: JoystickProps) {
  const knobSize = Math.round(size * 0.4);
  const maxTravel = (size - knobSize) / 2;
  const center = size / 2;

  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const activeScale = useRef(new Animated.Value(1)).current;
  const [activeDirection, setActiveDirection] = useState<JoystickDirection | null>(null);
  const [dragging, setDragging] = useState(false);

  const directionRef = useRef<JoystickDirection | null>(null);
  const startOffset = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const endRef = useRef<() => void>(() => {});
  const propsRef = useRef({ disabled, onDirectionChange, onRelease, maxTravel, center });
  propsRef.current = { disabled, onDirectionChange, onRelease, maxTravel, center };

  const responder = useMemo(() => {
    const setDirection = (next: JoystickDirection | null) => {
      if (next === directionRef.current) return;
      directionRef.current = next;
      setActiveDirection(next);
      propsRef.current.onDirectionChange(next);
    };

    const moveTo = (rawX: number, rawY: number) => {
      const { maxTravel: travel } = propsRef.current;
      const distance = Math.hypot(rawX, rawY);
      const scale = distance > travel ? travel / distance : 1;
      const x = rawX * scale;
      const y = rawY * scale;
      position.setValue({ x, y });
      setDirection(resolveDirection(x, y, travel, directionRef.current));
    };

    const end = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setDragging(false);
      directionRef.current = null;
      setActiveDirection(null);
      Animated.parallel([
        Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6, tension: 120 }),
        Animated.spring(activeScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start();
      propsRef.current.onRelease();
    };
    endRef.current = end;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        activeRef.current = true;
        setDragging(true);
        const { locationX, locationY } = evt.nativeEvent;
        startOffset.current = {
          x: locationX - propsRef.current.center,
          y: locationY - propsRef.current.center,
        };
        Animated.spring(activeScale, { toValue: 1.08, useNativeDriver: true, friction: 6 }).start();
        moveTo(startOffset.current.x, startOffset.current.y);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (!activeRef.current) return;
        if (propsRef.current.disabled) {
          end();
          return;
        }
        moveTo(startOffset.current.x + gesture.dx, startOffset.current.y + gesture.dy);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [position, activeScale]);

  useEffect(() => {
    if (disabled && activeRef.current) endRef.current();
  }, [disabled]);

  return (
    <View style={styles.wrapper}>
      <View
        {...responder.panHandlers}
        style={[
          styles.base,
          { width: size, height: size, borderRadius: size / 2 },
          dragging && styles.baseActive,
          disabled && styles.baseDisabled,
        ]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Drive joystick"
        accessibilityHint="Drag up, down, left or right to drive. Release to stop."
      >
        <View
          pointerEvents="none"
          style={[styles.ring, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]}
        />
        {ARROWS.map(({ dir, icon, style }) => (
          <View key={dir} pointerEvents="none" style={[styles.arrow, style]}>
            <Ionicons
              name={icon}
              size={28}
              color={activeDirection === dir ? colors.primary : colors.textFaint}
            />
          </View>
        ))}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.knob,
            {
              width: knobSize,
              height: knobSize,
              borderRadius: knobSize / 2,
              transform: [{ translateX: position.x }, { translateY: position.y }, { scale: activeScale }],
            },
            disabled && styles.knobDisabled,
          ]}
        >
          <View style={[styles.knobInner, { width: knobSize * 0.42, height: knobSize * 0.42, borderRadius: knobSize }]} />
        </Animated.View>
      </View>
      {disabled && disabledLabel ? <Text style={styles.disabledLabel}>{disabledLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  base: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  baseDisabled: { opacity: 0.45 },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  arrow: { position: 'absolute' },
  knob: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  knobDisabled: { backgroundColor: colors.textFaint },
  knobInner: { backgroundColor: 'rgba(255,255,255,0.28)' },
  disabledLabel: { marginTop: 10, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
