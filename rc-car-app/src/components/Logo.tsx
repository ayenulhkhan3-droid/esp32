import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export const APP_NAME = 'DriveLink';

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <View
      style={[styles.outer, { width: size, height: size, borderRadius: size * 0.32 }]}
      accessibilityRole="image"
      accessibilityLabel={`${APP_NAME} logo`}
    >
      <View
        style={[
          styles.ring,
          { width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39, borderWidth: Math.max(1, size * 0.018) },
        ]}
      />
      <MaterialCommunityIcons name="car-sports" size={size * 0.5} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ring: { position: 'absolute', borderColor: 'rgba(255,255,255,0.3)' },
});
