// Bearer-token storage for the help gateway's Discord sign-in. public/main.js stashes the
// token from the OAuth callback's URL fragment at startup under the SAME key (it is classic
// JS and cannot import this constant — keep them in sync by hand).

export const TOKEN_STORAGE = "fmg-help-token";

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
