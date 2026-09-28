const env = (import.meta as any).env ?? {};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

// VITE_API_URL se conserva como alias para no romper la configuracion actual.
export const PRIMARY_API_URL = trimTrailingSlash(
  env.VITE_API_PRIMARY_URL ||
    env.VITE_API_URL ||
    'https://three60-resumen.onrender.com'
);

export const FALLBACK_API_URL = trimTrailingSlash(
  env.VITE_API_FALLBACK_URL ||
    'https://backend-360-resumen-v2.vercel.app'
);

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const PRIMARY_TIMEOUT_MS = Number(env.VITE_API_PRIMARY_TIMEOUT_MS) || 3_000;
const FALLBACK_TIMEOUT_MS = Number(env.VITE_API_FALLBACK_TIMEOUT_MS) || 10_000;
const INITIAL_RECOVERY_DELAY_MS = 30_000;
const MAX_RECOVERY_DELAY_MS = 5 * 60_000;

let circuitState: CircuitState = 'CLOSED';
let retryPrimaryAt = 0;
let recoveryDelayMs = INITIAL_RECOVERY_DELAY_MS;

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const isRetryableError = (error: unknown): boolean =>
  !(error instanceof ApiRequestError) || error.retryable;

const buildUrl = (baseUrl: string, path: string): string => {
  if (!path.startsWith('/')) {
    throw new ApiRequestError(`La ruta de API debe iniciar con "/": ${path}`, false);
  }
  return `${baseUrl}${path}`;
};

async function fetchWithTimeout(
  baseUrl: string,
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(buildUrl(baseUrl, path), {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (callerSignal?.aborted) {
      throw new ApiRequestError('Solicitud cancelada por el cliente', false);
    }
    if (timedOut) {
      throw new ApiRequestError(`Timeout despues de ${timeoutMs} ms`, true);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function getJsonFrom<T>(baseUrl: string, path: string): Promise<T> {
  const timeout = baseUrl === PRIMARY_API_URL
    ? PRIMARY_TIMEOUT_MS
    : FALLBACK_TIMEOUT_MS;
  const response = await fetchWithTimeout(
    baseUrl,
    path,
    { method: 'GET', cache: 'no-store' },
    timeout
  );

  if (!response.ok) {
    throw new ApiRequestError(
      `HTTP ${response.status} en ${baseUrl}`,
      isRetryableStatus(response.status),
      response.status
    );
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiRequestError(`JSON invalido recibido desde ${baseUrl}`, true);
  }
}

function openCircuit(): void {
  circuitState = 'OPEN';
  retryPrimaryAt = Date.now() + recoveryDelayMs;
  recoveryDelayMs = Math.min(recoveryDelayMs * 2, MAX_RECOVERY_DELAY_MS);
}

function closeCircuit(): void {
  circuitState = 'CLOSED';
  retryPrimaryAt = 0;
  recoveryDelayMs = INITIAL_RECOVERY_DELAY_MS;
}

async function tryPrimaryThenFallback<T>(
  path: string,
  halfOpenProbe: boolean
): Promise<T> {
  try {
    const value = await getJsonFrom<T>(PRIMARY_API_URL, path);
    if (halfOpenProbe) closeCircuit();
    return value;
  } catch (error) {
    if (!isRetryableError(error)) {
      // Un 4xx confirma que Render responde; el error pertenece a la solicitud.
      if (halfOpenProbe) closeCircuit();
      throw error;
    }
    openCircuit();
    return getJsonFrom<T>(FALLBACK_API_URL, path);
  }
}

/**
 * Ejecuta una lectura JSON con Render como principal y Vercel como respaldo.
 * No realiza health checks periodicos: una solicitud real hace de sonda al
 * vencer el periodo OPEN. Solo una solicitud prueba Render en HALF_OPEN.
 */
export async function apiGetJson<T>(path: string): Promise<T> {
  if (circuitState === 'CLOSED') {
    return tryPrimaryThenFallback<T>(path, false);
  }

  if (circuitState === 'OPEN' && Date.now() < retryPrimaryAt) {
    return getJsonFrom<T>(FALLBACK_API_URL, path);
  }

  if (circuitState === 'HALF_OPEN') {
    return getJsonFrom<T>(FALLBACK_API_URL, path);
  }

  // La asignacion sincrona impide que varias solicitudes prueben Render a la vez.
  circuitState = 'HALF_OPEN';
  return tryPrimaryThenFallback<T>(path, true);
}

/** Peticiones con efectos: siempre van al principal y nunca se duplican. */
export function primaryApiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetchWithTimeout(PRIMARY_API_URL, path, init, FALLBACK_TIMEOUT_MS);
}

/** Lecturas administrativas ligadas explicitamente al servidor principal. */
export async function primaryApiGetJson<T>(path: string): Promise<T> {
  return getJsonFrom<T>(PRIMARY_API_URL, path);
}

export function getCircuitState(): CircuitState {
  return circuitState;
}
