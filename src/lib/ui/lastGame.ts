export const LAST_GAME_ID_KEY = "wr:last_game_id";

export function loadLastGameId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_GAME_ID_KEY);
}

export function saveLastGameId(gameId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_GAME_ID_KEY, gameId);
}
