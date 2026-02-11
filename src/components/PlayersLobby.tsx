"use client";

type Player = {
  id: string;
  display_name: string;
};

type PlayersLobbyProps = {
  players: Player[];
  meUserId: string;
  isHost: boolean;
  nationsByPlayerId: Record<string, string[]>;
  assignedNations: string[];
  onAssignNation: (playerId: string, nation: string) => void;
  onUnassignNation: (playerId: string, nation: string) => void;
};

/**
 * Formal rulebook nation names (strict).
 * Alliance rule:
 * - Axis: GERMANY, ITALY, IMPERIAL JAPAN
 * - Allied: SOVIET UNION, UNITED STATES, BRITISH COMMONWEALTH, CHINA
 */
const AXIS = ["GERMANY", "ITALY", "IMPERIAL JAPAN"] as const;
const ALLIED = ["SOVIET UNION", "UNITED STATES", "BRITISH COMMONWEALTH", "CHINA"] as const;

const ALL_NATIONS_FORMAL = [...ALLIED, ...AXIS] as const;

function allianceOf(nation: string): "AXIS" | "ALLIED" {
  return (AXIS as readonly string[]).includes(nation) ? "AXIS" : "ALLIED";
}

function AllianceBadge({ alliance }: { alliance: "AXIS" | "ALLIED" }) {
  const cls =
    alliance === "AXIS"
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : "border-sky-400/30 bg-sky-400/10 text-sky-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${cls}`}
      title={alliance === "AXIS" ? "Axis nations only" : "Allied nations only"}
    >
      {alliance}
    </span>
  );
}

export default function PlayersLobby({
  players,
  meUserId,
  isHost,
  nationsByPlayerId,
  assignedNations,
  onAssignNation,
  onUnassignNation,
}: PlayersLobbyProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
        Command Assignments
      </h2>

      <div className="space-y-3">
        {players.map((player) => {
          const isMe = player.id === meUserId;
          const playerNations = nationsByPlayerId[player.id] ?? [];

          // Lock alliance after the first nation is assigned
          const playerAlliance: "AXIS" | "ALLIED" | null =
            playerNations.length > 0 ? allianceOf(playerNations[0]) : null;

          return (
            <div
              key={player.id}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium">
                      {player.display_name}
                      {isMe && <span className="ml-2 text-xs text-amber-400">(You)</span>}
                    </div>

                    {playerAlliance && <AllianceBadge alliance={playerAlliance} />}
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    Nations controlled: {playerNations.length}
                    {playerAlliance ? ` • Locked to ${playerAlliance}` : " • Unassigned (choose Axis or Allied)"}
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500">{isHost ? "Host view" : "Player view"}</div>
              </div>

              {/* Assigned nations (click to unassign if host) */}
              <div className="mb-3 flex flex-wrap gap-2">
                {playerNations.length === 0 && (
                  <span className="text-xs text-zinc-500 italic">No nations assigned</span>
                )}

                {playerNations.map((nation) => (
                  <button
                    key={nation}
                    type="button"
                    onClick={() => isHost && onUnassignNation(player.id, nation)}
                    className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
                    disabled={!isHost}
                    title={isHost ? "Unassign nation" : undefined}
                  >
                    {nation}
                  </button>
                ))}
              </div>

              {/* Assignment controls (host only) */}
              {isHost && (
                <div className="flex flex-wrap gap-2">
                  {ALL_NATIONS_FORMAL.map((nation) => {
                    const taken = assignedNations.includes(nation);
                    const alreadyHas = playerNations.includes(nation);

                    // If nation is taken by another player, hide it (unless this player already has it)
                    if (taken && !alreadyHas) return null;

                    // Enforce single-alliance-per-player in UI:
                    const nationAlliance = allianceOf(nation);
                    if (playerAlliance && nationAlliance !== playerAlliance) return null;

                    return (
                      <button
                        key={nation}
                        type="button"
                        onClick={() => onAssignNation(player.id, nation)}
                        disabled={alreadyHas}
                        className={`rounded-full px-3 py-1 text-xs border transition ${
                          alreadyHas
                            ? "border-white/10 bg-white/5 text-zinc-500"
                            : "border-white/10 bg-zinc-950 text-zinc-300 hover:border-amber-400/40 hover:text-amber-200"
                        }`}
                        title={
                          alreadyHas
                            ? "Already assigned"
                            : playerAlliance
                              ? `Assign (${playerAlliance} only)`
                              : `Assign (${nationAlliance})`
                        }
                      >
                        {alreadyHas ? "✓ " : "+ "}
                        {nation}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
