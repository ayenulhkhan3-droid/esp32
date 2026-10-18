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
const MIN_GAP_MS = 700;

function usefulSpeech(text: string): string | null {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/\[unk\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2) return null;
  return cleaned;
}

export function VoiceControls({ disabled, disabledReason, cancelToken, onSubmit }: VoiceControlsProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [modelReady, setModelReady] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState<string | null>(
    'Tap mic once — voice stays ON until you tap Stop. Say aage, ruko, left…',
  );
  const [result, setResult] = useState<{ command: VoiceResultCommand; reply: string } | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const sessionActive = useRef(false);
  const busy = useRef(false);
  const lastSentAt = useRef(0);
  const lastText = useRef('');
  const mounted = useRef(true);
  const pulse = useRef(new Animated.Value(0)).current;

  const restartListening = useCallback(async () => {
    if (!sessionActive.current || !mounted.current) return;
    try {
      stopListening();
    } catch {
      // ignore
    }
    // Brief gap so Android mic releases cleanly
    await new Promise((r) => setTimeout(r, 180));
    if (!sessionActive.current || !mounted.current) return;
    try {
      await startListening();
      if (mounted.current && sessionActive.current) {
        setState('listening');
        setMessage('Voice ON — keep speaking commands. Tap red Stop to turn off.');
      }
    } catch (error) {
      if (!mounted.current || !sessionActive.current) return;
      // Retry once
      await new Promise((r) => setTimeout(r, 400));
      if (!sessionActive.current || !mounted.current) return;
      try {
        await startListening();
        setState('listening');
        setMessage('Voice ON — keep speaking commands. Tap red Stop to turn off.');
      } catch (err) {
        sessionActive.current = false;
        setState('error');
        setMessage(describeSpeechError(err));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setState('loading');
    setMessage('Loading offline speech model (one-time)\u2026');
    ensureModelLoaded()
      .then(() => {
        if (!mounted.current) return;
        setModelReady(true);
        setState('idle');
        setMessage('Tap mic once — stays ON until you Stop. One word = one command.');
      })
      .catch((error) => {
        if (!mounted.current) return;
        setModelReady(false);
        setState('error');
        setMessage(describeSpeechError(error));
      });
    return () => {
      mounted.current = false;
      sessionActive.current = false;
      abortListening();
    };
  }, []);

  useEffect(() => {
    if (cancelToken === 0) return;
    if (sessionActive.current) {
      sessionActive.current = false;
      abortListening();
      setState('idle');
      setMessage('Voice turned off by Emergency Stop.');
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

  const handleUtterance = useCallback(
    async (text: string) => {
      const cleaned = usefulSpeech(text);
      if (!cleaned || !sessionActive.current || busy.current) return;

      const now = Date.now();
      if (cleaned === lastText.current && now - lastSentAt.current < MIN_GAP_MS) return;
      if (now - lastSentAt.current < 350) return;

      busy.current = true;
      lastText.current = cleaned;
      lastSentAt.current = now;
      setTranscript(cleaned);
      setState('processing');
      setMessage('Sending command\u2026');

      try {
        // Pause recognizer while writing so we don't double-fire
        stopListening();
        const outcome = await onSubmit(cleaned);
        if (!mounted.current) return;
        if (outcome.superseded) {
          sessionActive.current = false;
          setResult(null);
          setState('idle');
          setMessage('Emergency Stop — voice turned off.');
          return;
        }
        setResult({ command: outcome.response.command, reply: outcome.response.reply });
        if (outcome.response.command === 'none') {
          setState('nomatch');
          setMessage('Not understood — still listening. Try: aage, ruko, left, spin…');
        } else {
          setState('success');
          setMessage(
            `${COMMAND_LABELS[outcome.response.command]} sent. Voice still ON — say next command or tap Stop.`,
          );
        }
      } catch (error) {
        if (!mounted.current) return;
        setResult(null);
        setState('error');
        setMessage(describeError(error));
      } finally {
        busy.current = false;
        if (sessionActive.current && mounted.current) {
          void restartListening();
        }
      }
    },
    [onSubmit, restartListening],
  );

  useEffect(() => {
    return subscribeSpeech({
      onPartial: (text) => {
        if (!sessionActive.current || busy.current) return;
        const cleaned = usefulSpeech(text);
        if (cleaned) setTranscript(cleaned);
      },
      onResult: (text) => {
        void handleUtterance(text);
      },
      onFinal: (text) => {
        // Session may end after silence — restart if user still wants voice ON
        void handleUtterance(text).finally(() => {
          if (sessionActive.current && !busy.current) void restartListening();
        });
      },
      onError: (error) => {
        if (!sessionActive.current) return;
        // Transient — try to keep session alive
        const msg = describeSpeechError(error);
        if (/already in use/i.test(String(error))) {
          void restartListening();
          return;
        }
        setMessage(msg);
        void restartListening();
      },
      onTimeout: () => {
        // Should not happen (no timeout) — restart if still ON
        if (sessionActive.current) void restartListening();
      },
    });
  }, [handleUtterance, restartListening]);

  const onMicPress = async () => {
    if (state === 'loading') return;

    // Toggle OFF
    if (sessionActive.current) {
      sessionActive.current = false;
      busy.current = false;
      stopListening();
      setState('idle');
      setMessage('Voice OFF. Tap mic to turn on again.');
      return;
    }

    if (disabled || !modelReady || state === 'processing') return;

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

    busy.current = false;
    lastText.current = '';
    sessionActive.current = true;
    setState('listening');
    setMessage('Voice ON — say commands anytime. Tap red Stop when done.');
    try {
      await startListening();
    } catch (error) {
      sessionActive.current = false;
      setState('error');
      setMessage(describeSpeechError(error));
    }
  };

  const showStop = sessionActive.current;
  const micColor = state === 'error' && !sessionActive.current ? colors.danger : colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
        <Text style={styles.badgeText}>Offline Vosk · stays on until you Stop</Text>
      </View>

      <View style={styles.micArea}>
        {showStop ? (
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
          disabled={state === 'loading' || (disabled && !showStop) || !modelReady}
          style={({ pressed }) => [
            styles.mic,
            { backgroundColor: showStop ? colors.danger : micColor },
            pressed && styles.micPressed,
            ((disabled && !showStop) || state === 'loading' || !modelReady) && styles.micDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={showStop ? 'Turn voice off' : 'Turn voice on'}
        >
          {state === 'loading' || (state === 'processing' && showStop) ? (
            <ActivityIndicator color={colors.white} size="large" />
          ) : (
            <Ionicons name={showStop ? 'stop' : 'mic'} size={40} color={colors.white} />
          )}
        </Pressable>
      </View>

      <Text style={styles.stateLabel}>
        {disabled && !showStop
          ? disabledReason ?? 'Voice control unavailable'
          : showStop
            ? state === 'processing'
              ? 'Sending… voice stays on'
              : 'Voice ON — listening'
            : {
                idle: 'Tap mic once to turn voice ON',
                loading: 'Loading offline model…',
                listening: 'Voice ON',
                processing: 'Processing…',
                success: 'Command sent',
                nomatch: 'Not understood',
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
          <Text style={[styles.message, state === 'error' && !showStop && styles.messageError]}>{message}</Text>
        ) : null}
        {permissionBlocked ? (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.settingsButton} accessibilityRole="button">
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.settingsText}>Open app settings</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.supported}>
        One tap ON · one word = one command ({SUPPORTED.join(', ')}). Hinglish: aage, peeche, ruko, ghumo.
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
