// Bearer-token storage for the help gateway's Discord sign-in, and the boot-time stash that
// takes the token out of the OAuth callback's URL fragment.

export const TOKEN_STORAGE = "fmg-help-token";
/** set by `signIn` before it redirects, read back here to refuse a token nobody asked for */
export const SIGNIN_PENDING = "fmg-help-signin-pending";
const TOKEN_FRAGMENT = "#token=";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE, token);
  } catch {
    // storage unavailable — the user simply stays signed out
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE);
  } catch {
    // nothing to clear
  }
}

/**
 * The OAuth callback comes back as `#token=<opaque token>`. Take it only when THIS client started
 * the sign-in, or a third party could plant a fragment in a link and sign the victim in as them.
 * The fragment is scrubbed either way: an unexpected token must not linger in the URL
 */
export function stashCallbackToken(): void {
  if (!location.hash.startsWith(TOKEN_FRAGMENT)) return;

  let signInPending = false;
  try {
    signInPending = sessionStorage.getItem(SIGNIN_PENDING) === "1";
  } catch {
    // storage unavailable — treat as not pending, i.e. do not accept the token
  }
  try {
    sessionStorage.removeItem(SIGNIN_PENDING);
  } catch {
    // nothing to clear
  }

  if (signInPending) storeToken(location.hash.slice(TOKEN_FRAGMENT.length));
  history.replaceState(null, "", location.pathname + location.search);
}
