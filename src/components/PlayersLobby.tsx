"use client";

import { useMemo } from "react";
import type { LobbyPlayer } from "@/lib/db/lobby";

const NATIONS = [
  "USA",
  "United Kingdom",
  "Soviet Union",
  "Germany",
  "Japan",
  "Italy",
  "China",
  "France",
] as const;

export default function PlayersLobby(props: {
  players: LobbyPlayer[];
  meUserId: string;
  isHost: boolean;
  onSetNation: (playerId: string, nation: string | null) => void;
}) {
  const { players, meUserId, isHost, onSetNation } = props;

  const taken = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) if (p.nation) s.add(p.nation);
    return s;
  }, [players]);

  return (
    <div className="rounded-2xl border p-5">
      <h2 className="text-lg font-semibold">Players</h2>

      <div className="mt-4 space-y-3">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">
                  {p.display_name}
                  {p.user_id === meUserId ? " (you)" : ""}
                </div>
                {p.is_host && (
                  <span className="rounded-full border px-2 py-0.5 text-xs">
                    Host
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Nation: {p.nation ?? "—"}
              </div>
            </div>

            {isHost ? (
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border p-2 text-sm"
                  value={p.nation ?? ""}
                  onChange={(e) =>
                    onSetNation(p.id, e.target.value ? e.target.value : null)
                  }
                >
                  <option value="">(Unassigned)</option>
                  {NATIONS.map((n) => (
                    <option
                      key={n}
                      value={n}
                      disabled={taken.has(n) && p.nation !== n}
                    >
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => onSetNation(p.id, null)}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!isHost && (
        <p className="mt-4 text-sm text-gray-600">
          Only the host can assign nations.
        </p>
      )}
    </div>
  );
}
