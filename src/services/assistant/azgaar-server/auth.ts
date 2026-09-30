// Bearer-token storage for the Azgaar server's Discord sign-in, and the boot-time stash that
// takes the token out of the OAuth callback's URL fragment.

export const TOKEN_STORAGE = "fmg-help-token";
/** set by `signIn` before it redirects, read back here to refuse a token nobody asked for */
export const SIGNIN_PENDING = "fmg-help-signin-pending";
const TOKEN_FRAGMENT = "#token=";

export const getToken = (): string | null => localStorage.getItem(TOKEN_STORAGE);
export const storeToken = (token: string): void => localStorage.setItem(TOKEN_STORAGE, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_STORAGE);

/**
 * The OAuth callback comes back as `#token=<opaque token>`. Take it only when THIS client started
 * the sign-in, or a third party could plant a fragment in a link and sign the victim in as them.
 * The fragment is scrubbed either way: an unexpected token must not linger in the URL
 */
export function stashCallbackToken(): void {
  if (!location.hash.startsWith(TOKEN_FRAGMENT)) return;
  const signInPending = sessionStorage.getItem(SIGNIN_PENDING) === "1";
  sessionStorage.removeItem(SIGNIN_PENDING);
  if (signInPending) storeToken(location.hash.slice(TOKEN_FRAGMENT.length));
  history.replaceState(null, "", location.pathname + location.search);
}
