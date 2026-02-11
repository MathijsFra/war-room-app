"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppHeaderProps = {
  rightSlot?: React.ReactNode;
};

export default function AppHeader({ rightSlot }: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <span className="text-amber-400">WAR ROOM</span>
              <span className="hidden sm:inline text-zinc-400">Operations Console</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
              <span className="h-1 w-1 rounded-full bg-zinc-600" />
              <span className="uppercase tracking-[0.18em]">{sectionFromPath(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {rightSlot}
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/70" title="Connected" />
          </div>
        </div>
      </div>
    </header>
  );
}

function sectionFromPath(pathname: string): string {
  if (pathname.startsWith("/resume")) return "Resume";
  if (pathname.startsWith("/lobby")) return "Lobby";
  if (pathname.startsWith("/game")) return "In Session";
  if (pathname.startsWith("/create-game")) return "Setup";
  if (pathname.startsWith("/join-game")) return "Join";
  if (pathname.startsWith("/auth") || pathname.startsWith("/sign-in")) return "Authentication";
  return "Command";
}
