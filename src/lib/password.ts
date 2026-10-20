// Optional app password (server-side gate). Kept in sessionStorage for this tab only, falling back
// to memory when storage is unavailable (private mode, disabled storage, non-browser tests).
// Never written to the URL or localStorage.

const STORAGE_KEY = "trendscope.appPassword";

let memoryPassword: string | undefined;

function storage(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

export function getPassword(): string | undefined {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // fall through to memory
  }
  return memoryPassword;
}

export function setPassword(value: string): void {
  memoryPassword = value;
  try {
    storage()?.setItem(STORAGE_KEY, value);
  } catch {
    // memory fallback already set
  }
}

export function clearPassword(): void {
  memoryPassword = undefined;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
