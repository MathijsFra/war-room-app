export function getCurrentNationKey(gameId: string) {
  return `wr_current_nation:${gameId}`;
}

export function loadCurrentNation(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(getCurrentNationKey(gameId));
}

export function saveCurrentNation(gameId: string, nation: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getCurrentNationKey(gameId), nation);
}
