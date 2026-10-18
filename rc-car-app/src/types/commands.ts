export const MOVEMENT_COMMANDS = ['forward', 'backward', 'left', 'right', 'spin', 'explore'] as const;

export type MovementCommand = (typeof MOVEMENT_COMMANDS)[number];
export type CarCommand = MovementCommand | 'stop';
export type VoiceResultCommand = CarCommand | 'none';

export type ControlMode = 'joystick' | 'voice';

/** Commands the joystick itself can produce (spin comes from the separate toggle). */
export type JoystickDirection = 'forward' | 'backward' | 'left' | 'right';

export const ALL_CAR_COMMANDS: readonly CarCommand[] = [...MOVEMENT_COMMANDS, 'stop'];

export function isCarCommand(value: unknown): value is CarCommand {
  return typeof value === 'string' && (ALL_CAR_COMMANDS as readonly string[]).includes(value);
}

export function isVoiceResultCommand(value: unknown): value is VoiceResultCommand {
  return value === 'none' || isCarCommand(value);
}

export interface SetCommandResponse {
  ok: true;
  command: CarCommand;
  mode?: string;
}

export interface VoiceCommandResponse {
  ok: true;
  command: VoiceResultCommand;
  reply: string;
  mode?: string;
}

export interface CarStateResponse {
  ok: true;
  data: {
    car_id: string;
    command: string;
    mode: string | null;
    command_id: string | null;
    command_expires_at: string | null;
    source: string | null;
  };
}

export const COMMAND_LABELS: Record<VoiceResultCommand, string> = {
  forward: 'Forward',
  backward: 'Backward',
  left: 'Left',
  right: 'Right',
  spin: 'Spin',
  explore: 'Explore',
  stop: 'Stop',
  none: 'Not understood',
};
