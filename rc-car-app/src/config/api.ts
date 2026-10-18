/**
 * Car + timing settings. Auth and commands go through Firebase only (no PHP).
 */
export const API_CONFIG = {
  carId: 'car001',
  requestTimeoutMs: 6000,
} as const;

export const CONTROL_TIMING = {
  /** Renew held joystick / spin commands well inside the expiry window. */
  commandRenewIntervalMs: 2500,
  /** How often to re-read car state from Realtime Database while idle. */
  heartbeatIntervalMs: 20000,
  /** Connection is stale if no Firebase success within this window. */
  connectionStaleMs: 12000,
  stopRetryCount: 3,
  stopRetryDelayMs: 700,
} as const;
