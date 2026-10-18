import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionPill, ConnectionStatus } from '../components/ConnectionPill';
import { EmergencyStopButton } from '../components/EmergencyStopButton';
import { Joystick } from '../components/Joystick';
import { APP_NAME, Logo } from '../components/Logo';
import { ModeSwitcher } from '../components/ModeSwitcher';
import { SpinToggle } from '../components/SpinToggle';
import { VoiceControls } from '../components/VoiceControls';
import { API_CONFIG, CONTROL_TIMING } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { CommandController, ControllerState } from '../services/commandController';
import { COMMAND_LABELS, ControlMode, JoystickDirection } from '../types/commands';
import { colors, radius, shadow } from '../theme';

function connectionStatus(state: ControllerState, offline: boolean): ConnectionStatus {
  if (offline) return 'offline';
  const { lastSuccessAt, lastFailureAt } = state;
  const successIsLatest = lastSuccessAt !== null && (lastFailureAt === null || lastSuccessAt >= lastFailureAt);
  if (successIsLatest && Date.now() - (lastSuccessAt ?? 0) < CONTROL_TIMING.connectionStaleMs) return 'online';
  if (lastFailureAt !== null) return 'error';
  return 'checking';
}

export function ControlScreen() {
  const { session, logout } = useAuth();
  const controllerRef = useRef<CommandController | null>(null);
  if (!controllerRef.current) controllerRef.current = new CommandController();
  const controller = controllerRef.current;
  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  const [mode, setMode] = useState<ControlMode>('joystick');
  const [offline, setOffline] = useState(false);
  const [cancelToken, setCancelToken] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const offlineRef = useRef(false);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((net) => {
      const isOffline = net.isConnected === false || net.isInternetReachable === false;
      if (isOffline === offlineRef.current) return;
      offlineRef.current = isOffline;
      setOffline(isOffline);
      if (isOffline) {
        setCancelToken((t) => t + 1);
        void controller.stop('Internet connection lost. Stop requested; the server also expires commands after 8 s.');
      } else {
        controller.resyncAfterReconnect();
        void controller.heartbeat();
      }
    });
    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        setCancelToken((t) => t + 1);
        void controller.stop();
      } else {
        void controller.heartbeat();
      }
    });
    return () => sub.remove();
  }, [controller]);

  useEffect(() => {
    void controller.heartbeat();
    const timer = setInterval(() => {
      if (!offlineRef.current && AppState.currentState === 'active') void controller.heartbeat();
    }, CONTROL_TIMING.heartbeatIntervalMs);
    return () => clearInterval(timer);
  }, [controller]);

  const onModeChange = useCallback(
    (next: ControlMode) => {
      setCancelToken((t) => t + 1);
      void controller.stop();
      controller.setMode(next);
      setMode(next);
    },
    [controller],
  );

  const onEmergencyStop = useCallback(() => {
    setCancelToken((t) => t + 1);
    void controller.stop();
  }, [controller]);

  const onDirectionChange = useCallback(
    (direction: JoystickDirection | null) => {
      if (direction) controller.drive(direction);
      else void controller.stop();
    },
    [controller],
  );

  const onJoystickRelease = useCallback(() => {
    if (controller.getState().desired !== 'stop') void controller.stop();
  }, [controller]);

  const spinOn = state.desired === 'spin';
  const onSpinToggle = useCallback(() => {
    if (controller.getState().desired === 'spin') void controller.stop();
    else controller.drive('spin');
  }, [controller]);

  const onVoiceSubmit = useCallback((text: string) => controller.sendVoice(text), [controller]);

  const onLogout = () => {
    Alert.alert('Log out?', 'The car will be stopped before you are logged out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          setCancelToken((t) => t + 1);
          const stopped = await controller.stop();
          if (!stopped) {
            setLoggingOut(false);
            Alert.alert(
              'Stop not confirmed',
              'The server did not confirm Stop. Log out anyway? The server expires commands after 8 s.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void logout() },
              ],
            );
            return;
          }
          await logout();
        },
      },
    ]);
  };

  const connection = connectionStatus(state, offline);
  const joystickSize = Math.round(Math.min(width * 0.7, height * 0.36, 300));
  const controlsBlocked = offline;

  const commandLabel = COMMAND_LABELS[state.desired];
  const commandDetail =
    state.desired === 'stop'
      ? state.stopStatus === 'sending'
        ? 'Sending Stop\u2026'
        : state.stopStatus === 'failed'
          ? 'Stop not confirmed'
          : state.stopStatus === 'confirmed'
            ? 'Confirmed by server'
            : 'Idle'
      : state.confirmed === state.desired
        ? mode === 'joystick'
          ? 'Confirmed \u2022 renewing while active'
          : 'Accepted by server \u2022 auto-expires'
        : 'Sending\u2026';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Logo size={38} />
        <View style={styles.headerText}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {`${API_CONFIG.carId} \u2022 ${session?.user.displayName ?? session?.user.username ?? ''}`}
          </Text>
        </View>
        <ConnectionPill status={connection} />
        <Pressable
          onPress={onLogout}
          disabled={loggingOut}
          hitSlop={8}
          style={styles.logout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          )}
        </Pressable>
      </View>

      <View style={styles.body}>
        <ModeSwitcher mode={mode} onChange={onModeChange} disabled={loggingOut} />

        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusLabel}>Current command</Text>
            <View style={styles.commandRow}>
              <Text style={[styles.command, state.desired === 'stop' && styles.commandStop]}>{commandLabel}</Text>
              {state.pending ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            <Text style={styles.commandDetail}>{commandDetail}</Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={styles.statusLabel}>Last confirmed</Text>
            <Text style={styles.serverCommand}>
              {state.confirmed ?? state.serverCommand ?? '\u2014'}
            </Text>
          </View>
        </View>

        {state.lastError ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Ionicons name="warning-outline" size={16} color={colors.dangerDark} />
            <Text style={styles.errorText}>{state.lastError}</Text>
          </View>
        ) : null}

        <View style={styles.modeArea}>
          {mode === 'joystick' ? (
            <View style={styles.joystickArea}>
              <Joystick
                size={joystickSize}
                disabled={controlsBlocked || spinOn || loggingOut}
                disabledLabel={
                  controlsBlocked ? 'No internet connection' : spinOn ? 'Turn Spin off to use the joystick' : undefined
                }
                onDirectionChange={onDirectionChange}
                onRelease={onJoystickRelease}
              />
              <View style={styles.spinWrap}>
                <SpinToggle
                  on={spinOn}
                  confirmed={state.confirmed === 'spin'}
                  disabled={(controlsBlocked && !spinOn) || loggingOut}
                  onToggle={onSpinToggle}
                />
              </View>
            </View>
          ) : (
            <VoiceControls
              disabled={controlsBlocked || loggingOut}
              disabledReason="No internet connection"
              cancelToken={cancelToken}
              onSubmit={onVoiceSubmit}
            />
          )}
        </View>

        <EmergencyStopButton status={state.stopStatus} onPress={onEmergencyStop} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerText: { flex: 1 },
  appName: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  logout: { padding: 6 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 12, gap: 12 },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow.card,
  },
  statusLeft: { flex: 1 },
  statusRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  statusLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 },
  commandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  command: { fontSize: 24, fontWeight: '800', color: colors.primary },
  commandStop: { color: colors.text },
  commandDetail: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  serverCommand: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6, textTransform: 'capitalize' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { flex: 1, color: colors.dangerDark, fontSize: 12.5, lineHeight: 17 },
  modeArea: { flex: 1, justifyContent: 'center' },
  joystickArea: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  spinWrap: { alignSelf: 'stretch', marginTop: 16 },
});
