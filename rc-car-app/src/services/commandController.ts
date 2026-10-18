import { CONTROL_TIMING } from '../config/api';
import {
  CarCommand,
  ControlMode,
  MovementCommand,
  VoiceCommandResponse,
} from '../types/commands';
import { getCarState, sendVoiceTranscript, setCarCommand } from './api';
import { ApiError, describeError, isApiError } from './http';

export type StopStatus = 'idle' | 'sending' | 'confirmed' | 'failed';

export interface ControllerState {
  /** What the app currently wants the car to do. */
  desired: CarCommand;
  /** Last command the server confirmed it stored. */
  confirmed: CarCommand | null;
  /** Command most recently read back from the server via `get`. */
  serverCommand: string | null;
  /** A write request (movement, voice, or stop) is in flight. */
  pending: boolean;
  stopStatus: StopStatus;
  lastError: string | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export interface VoiceOutcome {
  response: VoiceCommandResponse;
  /** True when an emergency Stop was pressed while this voice request was in flight. */
  superseded: boolean;
}

type Listener = (state: ControllerState) => void;

const RENEW_TICK_MS = 400;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Serialises every car write so requests never overlap and the newest intent wins.
 * Stop always preempts: it is sent immediately and re-sent if a movement request
 * that was already in flight lands after it.
 */
export class CommandController {
  private state: ControllerState = {
    desired: 'stop',
    confirmed: null,
    serverCommand: null,
    pending: false,
    stopStatus: 'idle',
    lastError: null,
    lastSuccessAt: null,
    lastFailureAt: null,
  };

  private listeners = new Set<Listener>();
  private mode: ControlMode = 'joystick';
  private renewDesired = false;
  private renewTimer: ReturnType<typeof setInterval> | null = null;
  private lastSentCommand: CarCommand | null = null;
  private lastSentAt = 0;

  private writeInFlight = false;
  private stopRequestedDuringWrite = false;
  private stopPromise: Promise<boolean> | null = null;
  private stopRepeat = false;
  private stopGeneration = 0;
  private stopReason: string | null = null;
  private heartbeatInFlight = false;
  private disposed = false;

  getState = (): ControllerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setMode(mode: ControlMode) {
    this.mode = mode;
  }

  /** Start (or switch to) a continuous movement that is renewed until stop() is called. */
  drive(command: MovementCommand) {
    if (this.disposed) return;
    if (this.state.desired === command && this.renewDesired) return;
    this.renewDesired = true;
    this.update({ desired: command, stopStatus: 'idle', lastError: null });
    this.ensureRenewTimer();
    this.pump();
  }

  /** Request Stop immediately. Resolves true only when the server confirmed it. */
  stop(reason?: string): Promise<boolean> {
    this.stopGeneration += 1;
    this.stopReason = reason ?? null;
    this.renewDesired = false;
    this.clearRenewTimer();
    this.update({
      desired: 'stop',
      ...(reason ? { lastError: reason } : null),
    });
    if (this.writeInFlight) this.stopRequestedDuringWrite = true;
    return this.runStop();
  }

  async sendVoice(message: string): Promise<VoiceOutcome> {
    if (this.disposed) throw new ApiError('aborted', 'Controller closed.');
    if (this.stopPromise) await this.stopPromise;
    if (this.writeInFlight) throw new ApiError('aborted', 'Another command is still being sent.');

    const generation = this.stopGeneration;
    this.writeInFlight = true;
    this.update({ pending: true });
    try {
      const response = await sendVoiceTranscript(message);
      this.markSuccess();
      const superseded = generation !== this.stopGeneration;
      if (!superseded && response.command !== 'none') {
        this.renewDesired = false;
        this.update({
          desired: response.command,
          confirmed: response.command,
          serverCommand: response.command,
          stopStatus: response.command === 'stop' ? 'confirmed' : 'idle',
          lastError: null,
        });
      }
      return { response, superseded };
    } catch (error) {
      this.markFailure(error);
      throw error;
    } finally {
      this.finishWrite();
    }
  }

  /** Read-only reachability check using the existing `get` action. Skipped while writing. */
  async heartbeat(): Promise<void> {
    if (this.disposed || this.heartbeatInFlight || this.writeInFlight || this.stopPromise) return;
    this.heartbeatInFlight = true;
    try {
      const data = await getCarState();
      this.markSuccess();
      // Hold the last confirmed drive command while renewing so RTDB read races
      // (fast Firebase) do not flicker the status between movement and stop.
      const display =
        this.state.desired !== 'stop' && this.state.confirmed
          ? this.state.confirmed
          : data.command;
      if (display !== this.state.serverCommand) {
        this.update({ serverCommand: String(display) });
      }
    } catch (error) {
      this.markFailure(error, { silent: true });
    } finally {
      this.heartbeatInFlight = false;
    }
  }

  /** Called when connectivity returns: re-confirm Stop if it was never confirmed. */
  resyncAfterReconnect() {
    if (this.state.desired === 'stop' && this.state.stopStatus !== 'confirmed') {
      void this.stop();
    }
  }

  /** Stops the car and prevents further driving. Used on logout / unmount. */
  dispose(): Promise<boolean> {
    this.disposed = true;
    const alreadyStopped =
      this.state.desired === 'stop' &&
      this.state.stopStatus === 'confirmed' &&
      !this.writeInFlight &&
      !this.stopPromise;
    const result = alreadyStopped ? Promise.resolve(true) : this.stop();
    this.listeners.clear();
    return result;
  }

  // ---------------------------------------------------------------------------

  private pump() {
    if (this.disposed || this.writeInFlight || this.stopPromise) return;
    const desired = this.state.desired;
    if (desired === 'stop' || !this.renewDesired) return;
    const due =
      this.lastSentCommand !== desired ||
      Date.now() - this.lastSentAt >= CONTROL_TIMING.commandRenewIntervalMs;
    if (due) void this.sendMovement(desired);
  }

  private async sendMovement(command: MovementCommand) {
    const generation = this.stopGeneration;
    this.writeInFlight = true;
    this.lastSentCommand = command;
    this.lastSentAt = Date.now();
    this.update({ pending: true });

    let failure: unknown = null;
    try {
      await setCarCommand(command, this.mode);
      this.markSuccess();
      if (generation === this.stopGeneration && this.state.desired === command) {
        this.update({ confirmed: command, serverCommand: command, lastError: null });
      }
    } catch (error) {
      failure = error;
      this.markFailure(error);
    }

    const stillWanted = generation === this.stopGeneration && this.state.desired === command;
    if (failure && stillWanted) {
      this.renewDesired = false;
      this.clearRenewTimer();
    }
    this.finishWrite();

    if (failure && stillWanted) {
      // Safety: any failed control request stops the car.
      void this.stop(`Control failed: ${describeError(failure)} Car was told to stop.`);
    }
  }

  private finishWrite() {
    this.writeInFlight = false;
    if (this.stopRequestedDuringWrite) {
      this.stopRequestedDuringWrite = false;
      if (this.state.desired === 'stop') {
        // The in-flight write may have reached the server after our Stop; send Stop again.
        if (this.stopPromise) this.stopRepeat = true;
        else void this.runStop();
      }
    }
    this.update({ pending: this.writeInFlight || this.stopPromise !== null });
    this.pump();
  }

  private runStop(): Promise<boolean> {
    if (this.stopPromise) {
      this.stopRepeat = true;
      return this.stopPromise;
    }
    this.update({ pending: true, stopStatus: 'sending' });

    const run = async (): Promise<boolean> => {
      let confirmed = false;
      let failures = 0;
      while (this.state.desired === 'stop') {
        this.stopRepeat = false;
        try {
          await setCarCommand('stop', this.mode);
          this.markSuccess();
          confirmed = true;
          this.lastSentCommand = 'stop';
          if (this.state.desired === 'stop') {
            this.update({ confirmed: 'stop', stopStatus: 'confirmed', lastError: this.stopReason });
          }
          if (!this.stopRepeat) break;
        } catch (error) {
          confirmed = false;
          failures += 1;
          this.markFailure(error);
          const fatal = isApiError(error) && error.kind === 'unauthorized';
          if (fatal || failures > CONTROL_TIMING.stopRetryCount) {
            if (this.state.desired === 'stop') {
              this.update({
                stopStatus: 'failed',
                lastError: `Stop NOT confirmed: ${describeError(error)} The server expires commands after 8 s.`,
              });
            }
            break;
          }
          await delay(CONTROL_TIMING.stopRetryDelayMs);
        }
      }
      return confirmed;
    };

    this.stopPromise = run().finally(() => {
      this.stopPromise = null;
      this.update({ pending: this.writeInFlight });
      this.pump();
    });
    return this.stopPromise;
  }

  private ensureRenewTimer() {
    if (this.renewTimer) return;
    this.renewTimer = setInterval(() => this.pump(), RENEW_TICK_MS);
  }

  private clearRenewTimer() {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
  }

  private markSuccess() {
    this.update({ lastSuccessAt: Date.now() });
  }

  private markFailure(error: unknown, { silent = false }: { silent?: boolean } = {}) {
    if (isApiError(error) && error.kind === 'aborted') return;
    this.update(
      silent ? { lastFailureAt: Date.now() } : { lastFailureAt: Date.now(), lastError: describeError(error) },
    );
  }

  private update(patch: Partial<ControllerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
