import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { VoiceOutcome } from '../services/commandController';
import { describeError } from '../services/http';
import {
  abortListening,
  describeSpeechError,
  ensureModelLoaded,
  ensureSpeechPermission,
  startListening,
  stopListening,
  subscribeSpeech,
} from '../services/speech';
import { COMMAND_LABELS, VoiceResultCommand } from '../types/commands';
import { colors, radius } from '../theme';

type VoiceState = 'idle' | 'loading' | 'listening' | 'processing' | 'success' | 'nomatch' | 'error';

interface VoiceControlsProps {
  disabled: boolean;
  disabledReason?: string;
  cancelToken: number;
  onSubmit: (transcript: string) => Promise<VoiceOutcome>;
}

const SUPPORTED = ['forward', 'backward', 'left', 'right', 'stop', 'spin', 'explore'] as const;

export function VoiceControls({ disabled, disabledReason, cancelToken, onSubmit }: VoiceControlsProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [modelReady, setModelReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState<string | null>(
    'Offline Vosk speech — say stop, aage, peeche, left, right, spin, explore',
  );
  const [result, setResult] = useState<{ command: VoiceResultCommand; reply: string } | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const sessionActive = useRef(false);
  const submitted = useRef(false);
  const mounted = useRef(true);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mounted.current = true;
    setState('loading');
    setMessage('Loading offline speech model (one-time)\u2026');
    ensureModelLoaded()
      .then(() => {
        if (!mounted.current) return;
        setModelReady(true);
        setState('idle');
        setMessage('Tap mic — offline Vosk (no Google). Say e.g. "aage", "ruko", "spin"');
      })
      .catch((error) => {
        if (!mounted.current) return;
        setModelReady(false);
        setState('error');
        setMessage(describeSpeechError(error));
      });
    return () => {
      mounted.current = false;
      if (sessionActive.current) abortListening();
    };
  }, []);

  useEffect(() => {
    if (cancelToken === 0) return;
    if (sessionActive.current) {
      sessionActive.current = false;
      abortListening();
      setState('idle');
      setMessage('Listening cancelled by Stop.');
    }
  }, [cancelToken]);

  useEffect(() => {
    if (state !== 'listening') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const submit = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) {
        setState('error');
        setMessage('No speech detected. Try again.');
        return;
      }
      setState('processing');
      setMessage('Sending command to Firebase\u2026');
      try {
        const outcome = await onSubmit(cleaned);
        if (!mounted.current) return;
        if (outcome.superseded) {
          setResult(null);
          setState('idle');
          setMessage('Emergency Stop was pressed — this voice command was overridden.');
          return;
        }
        setResult({ command: outcome.response.command, reply: outcome.response.reply });
        if (outcome.response.command === 'none') {
          setState('nomatch');
          setMessage('No movement sent. Try: stop, aage, peeche, left, right, spin, explore.');
        } else {
          setState('success');
          setMessage(
            outcome.response.command === 'stop'
              ? 'Stop written to Firebase.'
              : 'Command written to Firebase. Renewed while active / expires after a few seconds.',
          );
        }
      } catch (error) {
        if (!mounted.current) return;
        setResult(null);
        setState('error');
        setMessage(describeError(error));
      }
    },
    [onSubmit],
  );

  useEffect(() => {
    return subscribeSpeech({
      onPartial: (text) => {
        if (!sessionActive.current || submitted.current) return;
        setTranscript(text);
      },
      onResult: (text) => {
        if (!sessionActive.current || submitted.current) return;
        const cleaned = text.trim();
        setTranscript(cleaned);
        if (!cleaned) return;
        submitted.current = true;
        sessionActive.current = false;
        void submit(cleaned);
      },
      onFinal: (text) => {
        if (!sessionActive.current || submitted.current) return;
        const cleaned = text.trim();
        setTranscript(cleaned);
        submitted.current = true;
        sessionActive.current = false;
        void submit(cleaned || '');
      },
      onError: (error) => {
        if (!sessionActive.current && submitted.current) return;
        sessionActive.current = false;
        setState('error');
        setMessage(describeSpeechError(error));
      },
      onTimeout: () => {
        if (!sessionActive.current || submitted.current) return;
        sessionActive.current = false;
        setState('error');
        setMessage('No speech detected. Tap the mic and speak clearly.');
      },
    });
  }, [submit]);

  const onMicPress = async () => {
    if (state === 'processing' || state === 'loading') return;
    if (sessionActive.current) {
      stopListening();
      sessionActive.current = false;
      setState('idle');
      setMessage('Listening stopped.');
      return;
    }
    if (disabled || !modelReady) return;

    setResult(null);
    setTranscript('');
    setPermissionBlocked(false);

    const permission = await ensureSpeechPermission();
    if (permission !== 'granted') {
      setPermissionBlocked(permission === 'blocked');
      setState('error');
      setMessage(
        permission === 'blocked'
          ? 'Microphone permission is blocked. Enable it in Android settings.'
          : 'Microphone permission is required for Voice mode.',
      );
      return;
    }

    submitted.current = false;
    sessionActive.current = true;
    setState('listening');
    setMessage('Listening (offline Vosk)\u2026 tap mic to cancel');
    try {
      await startListening();
    } catch (error) {
      sessionActive.current = false;
      setState('error');
      setMessage(describeSpeechError(error));
    }
  };

  const listening = state === 'listening';
  const micColor = state === 'error' ? colors.danger : colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
        <Text style={styles.badgeText}>Offline Vosk · no Google speech</Text>
      </View>

      <View style={styles.micArea}>
        {listening ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
              },
            ]}
          />
        ) : null}
        <Pressable
          onPress={onMicPress}
          disabled={state === 'processing' || state === 'loading' || (disabled && !listening) || !modelReady}
          style={({ pressed }) => [
            styles.mic,
            { backgroundColor: listening ? colors.danger : micColor },
            pressed && styles.micPressed,
            ((disabled && !listening) || state === 'processing' || state === 'loading' || !modelReady) &&
              styles.micDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Start voice command'}
        >
          {state === 'processing' || state === 'loading' ? (
            <ActivityIndicator color={colors.white} size="large" />
          ) : (
            <Ionicons name={listening ? 'stop' : 'mic'} size={40} color={colors.white} />
          )}
        </Pressable>
      </View>

      <Text style={styles.stateLabel}>
        {disabled && !listening && state !== 'processing'
          ? disabledReason ?? 'Voice control unavailable'
          : {
              idle: 'Tap the mic and speak a command',
              loading: 'Loading offline model\u2026',
              listening: 'Listening offline\u2026',
              processing: 'Processing\u2026',
              success: 'Command sent',
              nomatch: 'Command not understood',
              error: 'Something went wrong',
            }[state]}
      </Text>

      <View style={styles.transcriptCard}>
        <Text style={styles.cardLabel}>Recognized speech</Text>
        <Text style={[styles.transcript, !transcript && styles.placeholder]}>
          {transcript ? `\u201C${transcript}\u201D` : 'Your words will appear here'}
        </Text>
        {result ? (
          <View style={styles.resultRow}>
            <View
              style={[
                styles.commandBadge,
                result.command === 'none' ? styles.badgeWarn : result.command === 'stop' ? styles.badgeStop : null,
              ]}
            >
              <Text style={styles.commandBadgeText}>{COMMAND_LABELS[result.command]}</Text>
            </View>
            {result.reply ? <Text style={styles.reply}>{result.reply}</Text> : null}
          </View>
        ) : null}
        {message ? (
          <Text style={[styles.message, state === 'error' && styles.messageError]}>{message}</Text>
        ) : null}
        {permissionBlocked ? (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.settingsButton} accessibilityRole="button">
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.settingsText}>Open app settings</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.supported}>
        Commands: {SUPPORTED.join(', ')}. Hinglish OK: aage, peeche, ruko. Explore = ultrasonic obstacle avoidance on
        the car (not AI).
      </Text>
    </View>
  );
}

const MIC = 96;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.success },
  micArea: { width: MIC * 1.8, height: MIC * 1.8, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.danger,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  micPressed: { opacity: 0.85 },
  micDisabled: { opacity: 0.5 },
  stateLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
  transcriptCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 },
  transcript: { fontSize: 17, color: colors.text, marginTop: 6, fontWeight: '500' },
  placeholder: { color: colors.textFaint, fontWeight: '400' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  commandBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeWarn: { backgroundColor: colors.warning },
  badgeStop: { backgroundColor: colors.danger },
  commandBadgeText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  reply: { flex: 1, fontSize: 14, color: colors.textMuted },
  message: { marginTop: 8, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  messageError: { color: colors.dangerDark },
  settingsButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  settingsText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },
  supported: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 10, lineHeight: 17 },
});
