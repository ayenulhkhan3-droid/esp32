import { PermissionsAndroid, Platform } from 'react-native';
import {
  loadModel,
  onError,
  onFinalResult,
  onPartialResult,
  onResult,
  onTimeout,
  start,
  stop,
  unload,
} from 'react-native-vosk';

/**
 * Offline open-source speech recognition via Vosk (Apache-2.0).
 * No Google Speech, no cloud STT, no paid APIs.
 */

export const VOSK_MODEL = 'model-en-in';

export const VOICE_GRAMMAR = [
  'stop',
  'forward',
  'backward',
  'back',
  'left',
  'right',
  'spin',
  'explore',
  'auto',
  'go',
  'aage',
  'peeche',
  'piche',
  'ruko',
  'roko',
  'chalo',
  'chalao',
  'baye',
  'daye',
  'ghumo',
  'ghoomo',
  '[unk]',
];

export type PermissionState = 'granted' | 'denied' | 'blocked';

let modelReady = false;
let modelLoading: Promise<void> | null = null;

export async function ensureSpeechPermission(): Promise<PermissionState> {
  if (Platform.OS !== 'android') return 'granted';
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (already) return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone',
    message: 'DriveLink needs the microphone for offline voice commands (Vosk).',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export async function ensureModelLoaded(): Promise<void> {
  if (modelReady) return;
  if (modelLoading) return modelLoading;
  modelLoading = loadModel(VOSK_MODEL)
    .then(() => {
      modelReady = true;
    })
    .catch((error) => {
      modelLoading = null;
      throw error;
    });
  return modelLoading;
}

export function isSpeechAvailable(): boolean {
  return true;
}

export async function startListening(): Promise<void> {
  await ensureModelLoaded();
  await start({
    grammar: VOICE_GRAMMAR,
    timeout: 8000,
  });
}

export function stopListening(): void {
  try {
    stop();
  } catch {
    // Already idle.
  }
}

export function abortListening(): void {
  stopListening();
}

export function unloadSpeech(): void {
  try {
    unload();
    modelReady = false;
    modelLoading = null;
  } catch {
    // Ignore.
  }
}

export function subscribeSpeech(handlers: {
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: unknown) => void;
  onTimeout?: () => void;
}): () => void {
  const subs: { remove: () => void }[] = [];
  if (handlers.onPartial) subs.push(onPartialResult(handlers.onPartial));
  if (handlers.onResult) subs.push(onResult(handlers.onResult));
  if (handlers.onFinal) subs.push(onFinalResult(handlers.onFinal));
  if (handlers.onError) subs.push(onError(handlers.onError));
  if (handlers.onTimeout) subs.push(onTimeout(handlers.onTimeout));
  return () => subs.forEach((s) => s.remove());
}

export function describeSpeechError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/permission|denied|not.?allowed/i.test(message)) {
    return 'Microphone permission was denied.';
  }
  if (/timeout/i.test(message)) {
    return 'No speech detected. Tap the mic and speak a command clearly.';
  }
  if (/model|load/i.test(message)) {
    return 'Offline speech model failed to load. Reinstall the app.';
  }
  return message || 'Speech recognition failed.';
}
