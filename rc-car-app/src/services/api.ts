import { get, ref, set } from 'firebase/database';
import { CAR_RTDB_PATH } from '../config/firebase';
import {
  CarCommand,
  ControlMode,
  SetCommandResponse,
  VoiceCommandResponse,
  isCarCommand,
} from '../types/commands';
import { CONTROL_TIMING } from '../config/api';
import { ApiError } from './http';
import { getFirebaseAuth, getFirebaseDatabase } from './firebaseApp';
import { matchVoiceCommand } from './voiceMatch';

export interface CarState {
  car_id: string;
  command: string;
  mode: string | null;
  command_id: string | null;
  command_expires_at: string | null;
  source: string | null;
}

type UnauthorizedHandler = (error: ApiError) => void;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Kept so AuthContext can wire session expiry (Firebase Auth handles tokens). */
export function configureCarApiAuth(
  _provider: () => string | null | Promise<string | null>,
  handler: UnauthorizedHandler,
) {
  onUnauthorized = handler;
}

function requireAuthUid(): string {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    const err = new ApiError('unauthorized', 'Your session has expired. Please log in again.');
    onUnauthorized(err);
    throw err;
  }
  return user.uid;
}

function randomId(): string {
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function ttlMs(command: CarCommand): number {
  // Keep expiry well ahead of renew so fast RTDB reads do not show stop mid-drive.
  return command === 'explore' ? 45_000 : CONTROL_TIMING.commandRenewIntervalMs * 8;
}

function toMysqlUtc(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

async function writeCommand(
  command: CarCommand,
  mode: ControlMode,
  source: 'app' | 'voice',
): Promise<void> {
  const uid = requireAuthUid();
  const expiresAt = Date.now() + ttlMs(command);
  const payload = {
    car_id: 'car001',
    command,
    mode,
    command_id: randomId(),
    command_expires_at: toMysqlUtc(expiresAt),
    expires_at_ms: expiresAt,
    source,
    updated_by: uid,
    updated_at: Date.now(),
  };
  try {
    await set(ref(getFirebaseDatabase(), CAR_RTDB_PATH), payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Realtime Database write failed.';
    if (/permission_denied|PERMISSION_DENIED/i.test(message)) {
      const err = new ApiError('unauthorized', 'Not allowed to control this car. Check Firebase rules / login email.');
      onUnauthorized(err);
      throw err;
    }
    if (/network|offline|Failed to get/i.test(message)) {
      throw new ApiError('offline', 'Cannot reach Firebase. Check your internet connection.');
    }
    throw new ApiError('server', message);
  }
}

export async function setCarCommand(command: CarCommand, mode: ControlMode): Promise<CarCommand> {
  await writeCommand(command, mode, 'app');
  return command;
}

export async function sendVoiceTranscript(message: string): Promise<VoiceCommandResponse> {
  const { command, reply } = matchVoiceCommand(message);
  if (command === 'none') {
    return { ok: true, command: 'none', reply };
  }
  await writeCommand(command, 'voice', 'voice');
  return { ok: true, command, mode: 'voice', reply };
}

export async function getCarState(): Promise<CarState> {
  requireAuthUid();
  try {
    const snap = await get(ref(getFirebaseDatabase(), CAR_RTDB_PATH));
    if (!snap.exists()) {
      return {
        car_id: 'car001',
        command: 'stop',
        mode: 'joystick',
        command_id: null,
        command_expires_at: null,
        source: null,
      };
    }
    const data = snap.val() as Record<string, unknown>;
    let command = typeof data.command === 'string' ? data.command : 'stop';
    const expiresMs = typeof data.expires_at_ms === 'number' ? data.expires_at_ms : null;
    if (command !== 'stop' && expiresMs !== null && expiresMs <= Date.now()) {
      command = 'stop';
    }
    if (!isCarCommand(command) && command !== 'stop') {
      command = 'stop';
    }
    return {
      car_id: 'car001',
      command,
      mode: typeof data.mode === 'string' ? data.mode : null,
      command_id: typeof data.command_id === 'string' ? data.command_id : null,
      command_expires_at: typeof data.command_expires_at === 'string' ? data.command_expires_at : null,
      source: typeof data.source === 'string' ? data.source : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Realtime Database read failed.';
    if (/permission_denied|PERMISSION_DENIED/i.test(message)) {
      const err = new ApiError('unauthorized', 'Not allowed to read car state. Check Firebase rules.');
      onUnauthorized(err);
      throw err;
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError('offline', 'Cannot reach Firebase. Check your internet connection.');
  }
}

/** @deprecated PHP removed — kept only for type compatibility with old SetCommandResponse imports. */
export type { SetCommandResponse };
