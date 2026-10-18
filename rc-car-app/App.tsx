import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from './src/components/Logo';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ControlScreen } from './src/screens/ControlScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

function Root() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'restoring') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'restoring') {
    return (
      <View style={styles.splash}>
        <Logo size={72} />
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </View>
    );
  }
  return status === 'signedIn' ? <ControlScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  spinner: { marginTop: 24 },
});
