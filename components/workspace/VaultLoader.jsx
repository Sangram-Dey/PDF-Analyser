"use client";

import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { ROBOT_CONFIG } from "@/hooks/useRobot";
import { cn } from "@/lib/utils";

// How long the vault stays shut and locked after the first words arrive, before the answer is shown.
// Shared with the robot, which does the locking (hooks/useRobot.js).
export const VAULT_LOCK_MS = ROBOT_CONFIG.vaultLockMs;

const MAX_PAPERS = 8; // papers drawn in the vault (a picture of the file's passages, not one per passage)

// The chat's loader while an answer is fetched: a secured vault in the middle of the chat, worked by the robot.
// Every phase follows the real answer stream (hooks/useWorkspace.js):
//   searching  the robot turns the wheel and pulls the door open; a scan runs over the papers inside
//   reading    the sources arrived: that many papers lift out to the robot, and the stack in the vault shrinks
//   locking    the first words arrived: the door swings shut and locks, then the answer shows
// total: the file's real passage count, sources: the real passages found.
export function VaultLoader({ stage, sources = [], total = 0 }) {
  // it appears shut and opens a frame later, so the door's swing always plays
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const searching = stage === "searching";
  const open = mounted && (searching || stage === "reading");
  const locked = stage === "locking";
  const found = sources.length;
  const papers = Math.min(MAX_PAPERS, Math.max(4, total || MAX_PAPERS));
  const picked = stage === "searching" ? 0 : Math.min(found, papers - 1); // always leave some behind in the vault
  const label = {
    searching: total ? `Opening the vault · searching ${total} passages` : "Opening the vault · searching",
    reading: found ? `Picked up ${found} paper${found === 1 ? "" : "s"} · thinking` : "Picking up papers · thinking",
    locking: "Vault locked · here's your answer",
  }[stage];

  return (
    <div role="status" className="mx-auto my-8 flex w-full max-w-sm flex-col items-center animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
      {/* data-robot-spot: the robot comes to this vault to open it, search, pick up the papers and lock it */}
      <div data-robot-spot="vault" className="relative h-44 w-60 [perspective:800px]">
        {/* the vault: a thick lit frame with bolts in the corners */}
        <div className="absolute inset-0 rounded-2xl border-2 border-glow/70 bg-card shadow-[0_0_48px_hsl(var(--glow)/0.18)]">
          {[["left-2", "top-2"], ["right-2", "top-2"], ["left-2", "bottom-2"], ["right-2", "bottom-2"]].map(([x, y]) => (
            <span key={x + y} aria-hidden="true" className={cn("absolute size-1.5 rounded-full bg-glow/50", x, y)} />
          ))}

          {/* inside: a shelf of papers. A scan runs over them while searching; the found ones lift out to the robot */}
          <div aria-hidden="true" className="absolute inset-4 overflow-hidden rounded-xl bg-background">
            <span className="absolute inset-x-3 bottom-5 h-px bg-glow/30" />
            <div className="absolute inset-x-0 bottom-5 flex items-end justify-center gap-1.5">
              {Array.from({ length: papers }, (_, index) => {
                const taken = index < picked;
                return (
                  <span
                    key={index}
                    className={cn(
                      "flex h-11 w-7 flex-col gap-1 rounded-sm border px-1 pt-1.5 transition-all duration-700 ease-in-out motion-reduce:transition-none",
                      taken
                        ? "-mx-[3px] w-0 -translate-x-28 -translate-y-10 rotate-[-18deg] scale-50 border-0 px-0 opacity-0" // carried off to the robot; the rest close up
                        : "border-glow/40 bg-card",
                      !taken && open && "shadow-[0_0_10px_hsl(var(--glow)/0.25)]",
                    )}
                    style={{ transitionDelay: taken ? `${index * 160}ms` : "0ms" }}
                  >
                    {[90, 70, 80].map((width) => <span key={width} className="h-0.5 rounded-full bg-glow/40" style={{ width: `${width}%` }} />)}
                  </span>
                );
              })}
            </div>
            {/* keeps scanning while the AI thinks too (that wait can be long), until the door shuts */}
            {(searching || stage === "reading") && <span className="absolute inset-y-2 w-0.5 bg-glow shadow-[0_0_10px_2px_hsl(var(--glow)/0.6)] motion-safe:animate-sweep" />}
          </div>

          {/* the door: the wheel turns first, then it swings open on its left hinge; it shuts again to lock */}
          <div
            className={cn(
              "absolute inset-4 grid origin-left place-items-center rounded-xl border-2 border-glow bg-secondary shadow-[inset_0_0_24px_hsl(var(--glow)/0.15)] transition-transform duration-1000 ease-in-out motion-reduce:transition-none",
              open ? "[transform:rotateY(-108deg)]" : "[transform:rotateY(0deg)]",
              searching && "[transition-delay:600ms]", // let the wheel turn before the door swings
            )}
          >
            <svg
              viewBox="0 0 64 64"
              aria-hidden="true"
              className={cn(
                "size-20",
                searching && "motion-safe:animate-[spin_1.2s_ease-in-out_1]", // unlocking turn
                locked && "motion-safe:animate-[spin_0.8s_ease-out_1_reverse]", // locking turn
              )}
            >
              <circle cx="32" cy="32" r="26" strokeWidth="3" className="fill-none stroke-glow" />
              <circle cx="32" cy="32" r="18" strokeWidth="1.5" strokeDasharray="4 3" className="fill-none stroke-glow/60" />
              {[0, 45, 90, 135].map((angle) => (
                <line key={angle} x1="32" y1="8" x2="32" y2="56" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${angle} 32 32)`} className="stroke-glow/80" />
              ))}
              <circle cx="32" cy="32" r="6" className="fill-glow drop-shadow-[0_0_6px_hsl(var(--glow))]" />
            </svg>
            {/* lock light: amber while open, teal once locked */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full",
                locked ? "bg-primary/20 text-primary" : "bg-warning-foreground text-warning motion-safe:animate-pulse",
              )}
            >
              {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs font-semibold text-glow transition-opacity duration-300">{label}</p>

      {/* the picked-up papers: the real passages, one after another */}
      {!searching && found > 0 && (
        <ul className="mt-2 flex max-w-full flex-wrap justify-center gap-1.5">
          {sources.map((source, index) => (
            <li
              key={source.number}
              title={`${source.filename} · ${source.location}`}
              className="max-w-40 truncate rounded-full border border-glow/40 bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground animate-in fade-in slide-in-from-top-2 fill-mode-both duration-500 motion-reduce:animate-none"
              style={{ animationDelay: `${300 + index * 160}ms` }} // after their paper has lifted out
            >
              [{source.number}] {source.location}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
