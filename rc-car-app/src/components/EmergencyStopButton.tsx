import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { StopStatus } from '../services/commandController';
import { colors, radius } from '../theme';

interface EmergencyStopButtonProps {
  status: StopStatus;
  onPress: () => void;
}

const SUBTITLE: Record<StopStatus, string> = {
  idle: 'Tap to stop the car immediately',
  sending: 'Sending Stop to server\u2026',
  confirmed: 'Stop confirmed by server',
  failed: 'Stop NOT confirmed \u2014 tap to retry',
};

export function EmergencyStopButton({ status, onPress }: EmergencyStopButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          pressIn();
          onPress();
        }}
        onPressOut={pressOut}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, status === 'failed' && styles.failed]}
        accessibilityRole="button"
        accessibilityLabel="Emergency stop"
        accessibilityHint={SUBTITLE[status]}
      >
        <View style={styles.iconWrap}>
          {status === 'sending' ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Ionicons name="hand-left" size={24} color={colors.danger} />
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>EMERGENCY STOP</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {SUBTITLE[status]}
          </Text>
        </View>
        {status === 'confirmed' ? <Ionicons name="checkmark-circle" size={22} color={colors.white} /> : null}
        {status === 'failed' ? <Ionicons name="warning" size={22} color={colors.white} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72,
    shadowColor: colors.danger,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: { backgroundColor: colors.dangerDark },
  failed: { backgroundColor: colors.dangerDark, borderWidth: 2, borderColor: colors.warning },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: colors.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, marginTop: 2 },
});
