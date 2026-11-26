let listenersRegistered = false;

export const GMP_QUOTA_EXCEEDED_EVENT = 'gmp-quota-exceeded';

/**
 * Registers global Google Maps JavaScript API quota / auth failure listeners
 * before React mounts (Case A Demo Key quota defense).
 */
export function registerMapsQuotaListeners(): void {
  if (typeof window === 'undefined' || listenersRegistered) return;
  listenersRegistered = true;

  const win = window as Window & { gm_authFailure?: () => void };
  const prevAuthFailure = win.gm_authFailure;
  win.gm_authFailure = () => {
    if (typeof prevAuthFailure === 'function') {
      prevAuthFailure();
    }
    window.dispatchEvent(new CustomEvent(GMP_QUOTA_EXCEEDED_EVENT));
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent(GMP_QUOTA_EXCEEDED_EVENT));
    }
  };
}
