"use client";

import { useEffect, useRef, useState } from "react";
import { ROBOT_CONFIG } from "@/hooks/useRobot";
import { cn } from "@/lib/utils";

// The lab robot: one character for the whole page. It perches on a spot, an element marked data-robot-spot
// ("projects", "documents", "shredder", "chat" = the question box), and glides between them.
// Its state, spot and speech bubble come from hooks/useRobot.js (real app events only).
// On phones (stacked layout) it docks in a corner instead of travelling. It never blocks clicks.

const VIEW = 80; // the drawing's own coordinates (viewBox)
const SIZE = ROBOT_CONFIG.size; // px on screen

const BADGE_TONE = { error: "border-destructive/60 text-destructive", complete: "border-glow text-glow", ready: "border-glow text-glow" };

// The eyes change with the mood: round, wide, happy arcs, narrow red, or glancing.
function Eyes({ state }) {
  if (state === "dizzy") {
    return [28, 52].map((x) => (
      <path key={x} d={`M${x - 3.5} 24.5 L${x + 3.5} 31.5 M${x + 3.5} 24.5 L${x - 3.5} 31.5`} strokeWidth="2.2" strokeLinecap="round" className="stroke-glow" />
    ));
  }
  if (state === "complete" || state === "ready") {
    return [28, 52].map((x) => (
      <path key={x} d={`M${x - 4} 30 Q${x} 24 ${x + 4} 30`} strokeWidth="2.2" strokeLinecap="round" className="fill-none stroke-glow drop-shadow-[0_0_4px_hsl(var(--glow))]" />
    ));
  }
  const wide = state === "upload" || state === "found" || state === "listening" || state === "explore";
  const height = state === "sleepy" ? 1.6 : state === "error" ? 4.5 : state === "read" ? 5 : wide ? 9 : 7; // sleepy: eyes shut
  const y = (state === "thinking" ? 24 : state === "read" ? 30 : 28) - height / 2; // thinking: eyes up; reading: eyes down
  return (
    <g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      className={cn(
        (state === "idle" || state === "assist") && "motion-safe:animate-blink",
        (state === "processing" || state === "retrieval" || state === "explore" || state === "extract") && "motion-safe:animate-look",
        state === "read" && "motion-safe:animate-[look_1.2s_ease-in-out_infinite_alternate]", // eyes run along the lines
        state === "thinking" && "motion-safe:animate-[look_1.4s_ease-in-out_infinite_alternate]",
      )}
    >
      {[28, 52].map((x) => (
        <rect
          key={x}
          x={x - 3.5} y={y} width="7" height={height} rx="2.5"
          className={cn(
            "transition-all duration-300",
            state === "error" ? "fill-destructive" : "fill-glow",
            state === "idle" || state === "sleepy" ? "opacity-75" : "opacity-100 drop-shadow-[0_0_4px_hsl(var(--glow))]",
          )}
        />
      ))}
    </g>
  );
}

// Retrieval: a barcode-style scan. A beam from its eyes onto a strip of bars, with a scan line running across.
function BarcodeScan() {
  return (
    <g aria-hidden="true">
      <path d="M36 32 L6 62 H74 L44 32 Z" className="fill-glow/10" />
      <rect x="6" y="62" width="68" height="14" rx="2" strokeWidth="1" className="fill-background/80 stroke-glow/50" />
      {[9, 12, 14, 18, 21, 25, 27, 31, 35, 37, 41, 44, 48, 51, 53, 57, 61, 63, 67, 70].map((x, index) => (
        <rect key={x} x={x} y="64.5" width={index % 3 ? 1 : 2} height="9" className="fill-glow/60" />
      ))}
      <rect x="6" y="61" width="2" height="16" className="fill-glow drop-shadow-[0_0_5px_hsl(var(--glow))] motion-safe:animate-beam" />
    </g>
  );
}

// Arm poses: degrees each arm turns at its shoulder (0 = hanging down). Positive turns clockwise.
//   extract  right arm raised, holding a magnifier that sweeps the file
//   pack     both arms forward, holding a box
//   retrieval both arms up, gripping the vault's wheel
//   thinking right arm out to the stack of pages it carries
//   complete, ready, found: the right arm waves
const ARMS = {
  extract: { left: 0, right: -100 },
  pack: { left: -50, right: 50 },
  retrieval: { left: 100, right: -100 },
  lock: { left: 100, right: -100 },
  thinking: { left: 0, right: -25 },
  error: { left: 150, right: -150 }, // hands up: "uh oh"
};
const WAVING = new Set(["complete", "ready", "found"]);

// One arm: a short limb and a round hand, turning at the shoulder. holding: what's drawn in its hand.
function Arm({ side, angle, waving, sweeping, holding }) {
  const shoulder = side === "left" ? { x: 27, y: 49 } : { x: 53, y: 49 };
  const hand = side === "left" ? { x: 21, y: 57 } : { x: 59, y: 57 };
  return (
    <g
      style={{
        transformBox: "view-box",
        transformOrigin: `${shoulder.x}px ${shoulder.y}px`,
        transform: waving || sweeping ? undefined : `rotate(${angle}deg)`,
      }}
      className={cn(
        "transition-transform duration-500 ease-out motion-reduce:transition-none",
        waving && "motion-safe:animate-wave",
        sweeping && "motion-safe:animate-scanarm",
        (waving || sweeping) && "motion-reduce:[transform:rotate(-120deg)]",
      )}
    >
      <line x1={shoulder.x} y1={shoulder.y} x2={hand.x} y2={hand.y} strokeWidth="2.6" strokeLinecap="round" className="stroke-glow/80" />
      <circle cx={hand.x} cy={hand.y} r="2.4" className="fill-card stroke-glow" strokeWidth="1.4" />
      {holding}
    </g>
  );
}

// A little burst of sparkles around the head when something good happens (found, extracted, done).
function Sparkles() {
  return (
    <g aria-hidden="true">
      {[[6, 12], [74, 10], [4, 40], [76, 38], [40, -4]].map(([x, y], index) => (
        <path
          key={index}
          d={`M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z`}
          style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${index * 90}ms` }}
          className="fill-glow opacity-0 motion-safe:animate-pop motion-reduce:opacity-80"
        />
      ))}
    </g>
  );
}

export function RobotDrawing({ state, moving }) {
  const pose = ARMS[state] ?? { left: 0, right: 0 };
  const working = state !== "idle";
  const lit = state === "thinking" || state === "answering" || state === "found" || state === "explore" || state === "extract" || state === "pack";
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" className="size-full overflow-visible">
      {state === "retrieval" && <BarcodeScan />}
      <g
        style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
        className={cn(
          "transition-transform duration-500",
          (state === "idle" || state === "assist") && !moving && "motion-safe:animate-float",
          (state === "upload" || state === "complete" || state === "ready" || state === "found") && "motion-safe:animate-hop",
          state === "pack" && "motion-safe:animate-[hop_0.7s_ease-in-out_infinite]", // bounces the box to pack it
          state === "extract" && "rotate-[-6deg]", // leans toward the file it's reading
          state === "error" && "motion-safe:animate-shake",
          state === "dizzy" && "motion-safe:animate-[shake_0.35s_ease-in-out_4]", // still wobbling from the shake
          state === "thinking" && "motion-safe:animate-tilt",
          state === "retrieval" && "motion-safe:animate-[tilt_0.5s_ease-in-out_infinite_alternate]", // heaves at the vault's wheel
          state === "lock" && "motion-safe:animate-[tilt_0.3s_ease-in-out_3_alternate]", // spins the wheel shut
          (state === "processing" || state === "read") && "rotate-[-8deg]", // leans in to watch the shredder or read
          state === "explore" && "rotate-[5deg]", // turns to look around the project list
          state === "sleepy" && "rotate-[12deg] opacity-80", // head droops
          moving && "rotate-6",
        )}
      >
        {/* antenna */}
        <line x1="40" y1="6" x2="40" y2="14" strokeWidth="1.5" className="stroke-glow/50" />
        <circle
          cx="40" cy="5" r="2.6"
          className={cn(
            lit ? "fill-glow drop-shadow-[0_0_5px_hsl(var(--glow))]" : state === "error" ? "fill-destructive" : "fill-muted-foreground/50",
            state === "thinking" && "motion-safe:animate-pulse",
          )}
        />
        {/* head, visor, ears */}
        <rect x="16" y="14" width="48" height="30" rx="11" strokeWidth="2.6" className={cn("fill-card drop-shadow-[0_0_4px_hsl(var(--glow)/0.5)]", working ? "stroke-glow" : "stroke-glow/80")} /> {/* a deep, lit outline */}
        <rect x="21" y="19" width="38" height="18" rx="7" strokeWidth="1.2" className="fill-background stroke-glow/40" />
        <Eyes state={state} />
        <rect x="12" y="24" width="4" height="10" rx="2" className="fill-glow/30" />
        <rect x="64" y="24" width="4" height="10" rx="2" className="fill-glow/30" />
        {/* body with a chest light that glows while it answers */}
        <path d="M29 46 H51 L55 58 H25 Z" strokeWidth="2.4" className="fill-card stroke-glow/75" />
        <circle cx="40" cy="52" r="2.2" className={state === "answering" ? "fill-glow motion-safe:animate-pulse" : "fill-glow/30"} />
        {/* while it collects the passages: a small stack of pages held at its side */}
        {state === "thinking" && (
          <g className="motion-safe:animate-pulse">
            <rect x="58" y="44" width="13" height="16" rx="1.5" strokeWidth="1.2" className="fill-secondary stroke-glow" />
            <rect x="55" y="47" width="13" height="16" rx="1.5" strokeWidth="1.2" className="fill-secondary stroke-glow" />
            {[51, 54, 57].map((y) => <line key={y} x1="57.5" y1={y} x2="65.5" y2={y} strokeWidth="1" className="stroke-glow/70" />)}
          </g>
        )}
        {/* arms: they swing at the shoulder to each state's pose */}
        <Arm side="left" angle={pose.left} />
        <Arm
          side="right"
          angle={pose.right}
          waving={WAVING.has(state)}
          sweeping={state === "extract"}
          holding={
            state === "extract" && (
              // a magnifier in its hand
              <g>
                <line x1="61" y1="59" x2="64" y2="63" strokeWidth="2" strokeLinecap="round" className="stroke-glow" />
                <circle cx="67" cy="66" r="4.2" strokeWidth="1.6" className="fill-glow/20 stroke-glow" />
              </g>
            )
          }
        />
        {/* the box it packs your file into */}
        {state === "pack" && (
          <g>
            <rect x="31" y="54" width="18" height="11" rx="1.5" strokeWidth="1.4" className="fill-secondary stroke-glow" />
            <path d="M31 54 L40 50 L49 54" strokeWidth="1.4" className="fill-none stroke-glow" />
            <line x1="40" y1="54" x2="40" y2="65" strokeWidth="1" className="stroke-glow/60" />
          </g>
        )}
        {(WAVING.has(state) || state === "complete") && <Sparkles />}
        {/* hover thruster: glows while it travels */}
        <ellipse cx="40" cy="61" rx="9" ry="2" className={cn("fill-glow transition-opacity duration-300", moving ? "opacity-60" : "opacity-15")} />
      </g>
    </svg>
  );
}

// Where a spot is on screen: perched on the top-right corner of the marked element.
function spotPosition(spot) {
  const element =
    document.querySelector(`[data-robot-spot="${spot}"]`) ??
    (spot.startsWith("export") ? document.querySelector('[data-robot-spot="export"]') : null) ?? // an export area not shown yet
    document.querySelector('[data-robot-spot="chat"]'); // e.g. the file list is in a collapsed panel
  const box = element?.getBoundingClientRect();
  if (!box?.width) return corner(); // nothing on screen: wait in the corner
  // the export drawer: it stands just outside the drawer's left edge (never covering the form), level with where
  // the work happens: the drawer's top while you choose, the results while it extracts, the buttons while it packs
  const found = element.dataset.robotSpot;
  if (found?.startsWith("export")) {
    const drawer = element.closest('[role="dialog"]')?.getBoundingClientRect() ?? box;
    const y = found === "export" ? box.top + 24 : box.top + Math.min(box.height, SIZE * 2) / 2 - SIZE / 2;
    return { x: drawer.left - SIZE * 0.9, y };
  }
  // the vault: it stands at the door (left side), level with the wheel, to work it
  if (spot === "vault" && element.dataset.robotSpot === "vault") return { x: box.left - SIZE * 0.8, y: box.top + box.height / 2 - SIZE / 2 };
  return { x: box.right - SIZE + 4, y: box.top - SIZE * 0.78 }; // its feet rest on the element's top edge
}

// Bottom-right corner: phones (stacked layout) and pages where no spot is on screen.
const corner = () => ({ x: window.innerWidth - SIZE - 12, y: window.innerHeight - SIZE - 12 });

// Keeps the whole robot inside the window, whatever the spot or wherever it's dragged.
function inWindow({ x, y }) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - SIZE - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - SIZE - margin),
  };
}

// What it can hide behind.
//   Hide and seek (random): the main sections, marked data-robot-hide.
//   Naps (nearest, after auto sleep or a shake): any solid box on screen (a card, a panel, the vault, the question
//   box…), so it ducks behind whatever is closest. "Solid" = a mostly opaque background: hiding behind a see-through
//   box would just look like vanishing. Page-sized wrappers are skipped.
function hidingBoxes(anyBox) {
  if (!anyBox) return document.querySelectorAll("[data-robot-hide]");
  const page = window.innerWidth * window.innerHeight;
  return [...document.querySelectorAll("main div, main section, main aside, main header, main form, main ul, main li, [data-robot-hide]")].filter(
    (element) => {
      if (element.closest("[data-robot]")) return false;
      const box = element.getBoundingClientRect();
      if (box.width * box.height > page * 0.6) return false;
      const alpha = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.[3];
      return alpha === undefined ? getComputedStyle(element).backgroundColor !== "transparent" : Number(alpha) >= 0.6;
    },
  );
}

// A hiding place: one edge (side) of a box from hidingBoxes, with where the robot sits when
//   hidden  fully behind the section          peek  part of it showing past the edge          out  just outside the edge
// "Behind" is drawn by cutting away the part of the robot that overlaps the section (clipFor).
// On phones, or when no section has room, it hides below the bottom edge of the screen.
// near ({ x, y }, optional): pick the hiding place closest to there (for naps) instead of a random one.
function pickHideout(near) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const room = SIZE + 16;
  const options = [];
  if (window.matchMedia("(min-width: 1024px)").matches) {
    for (const element of hidingBoxes(!!near)) {
      const box = element.getBoundingClientRect();
      if (box.width < SIZE + 16 || box.height < SIZE + 16) continue; // big enough to hide all of it
      if (box.left > room) options.push({ box, side: "left" });
      if (width - box.right > room) options.push({ box, side: "right" });
      if (box.top > room) options.push({ box, side: "top" });
      if (height - box.bottom > room) options.push({ box, side: "bottom" });
    }
  }
  if (!options.length) options.push({ box: { left: 0, right: width, top: height, bottom: height + SIZE * 2 }, side: "top" });

  const peek = SIZE * 0.45;
  const gap = 6;
  // where along the edge: random, or as close to `near` as the edge allows; kept on screen either way
  const along = (min, max, wanted) => {
    const high = Math.max(min, max);
    return wanted == null ? min + Math.random() * (high - min) : Math.min(Math.max(wanted, min), high);
  };
  const withPositions = ({ box, side }) => {
    const x = along(Math.max(box.left, 0) + 8, Math.min(box.right, width) - SIZE - 8, near?.x);
    const y = along(Math.max(box.top, 0) + 8, Math.min(box.bottom, height) - SIZE - 8, near?.y);
    const at = {
      left: { hidden: { x: box.left, y }, peek: { x: box.left - peek, y }, out: { x: box.left - SIZE - gap, y } },
      right: { hidden: { x: box.right - SIZE, y }, peek: { x: box.right - SIZE + peek, y }, out: { x: box.right + gap, y } },
      top: { hidden: { x, y: box.top }, peek: { x, y: box.top - peek }, out: { x, y: box.top - SIZE - gap } },
      bottom: { hidden: { x, y: box.bottom - SIZE }, peek: { x, y: box.bottom - SIZE + peek }, out: { x, y: box.bottom + gap } },
    }[side];
    return { box, side, at };
  };

  const all = options.map(withPositions);
  if (!near) {
    // A random hiding style, weighted by ROBOT_CONFIG.hideStyles, among the ones possible right now:
    //   sections  behind an edge of one of the main sections
    //   dropDown  down from behind the "Ask your documents" header's lower edge into the chat (the cut hides
    //             everything above that edge, so it works although the header is shorter than the robot)
    //   popUp     up from behind that header's upper edge (antenna and eyes first), ending perched on top of it
    //             with its feet still tucked behind
    //   corner    in from the right edge of the screen, near the bottom-right corner
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const header = wide ? document.querySelector("[data-robot-drop]")?.getBoundingClientRect() : null;
    const hasHeader = header?.width > SIZE;
    const styles = {
      sections: wide && options.length ? () => all[Math.floor(Math.random() * all.length)] : null,
      dropDown: hasHeader && height - header.bottom > room ? () => withPositions({ box: header, side: "bottom" }) : null,
      popUp: hasHeader && header.top > SIZE * 0.5
        ? () => {
            const popUp = withPositions({ box: header, side: "top" });
            return { ...popUp, at: { ...popUp.at, out: { x: popUp.at.out.x, y: Math.max(4, header.top - SIZE * 0.78) } } };
          }
        : null,
      corner: wide
        ? () => {
            const y = height - SIZE - 16 - Math.random() * height * 0.25; // low on the right edge
            const box = { left: width, right: width + SIZE * 2, top: 0, bottom: height }; // just off screen
            return { box, side: "left", at: { hidden: { x: width, y }, peek: { x: width - peek, y }, out: { x: width - SIZE - 12, y } } };
          }
        : null,
    };
    const available = Object.entries(ROBOT_CONFIG.hideStyles).filter(([name, weight]) => styles[name] && weight > 0);
    if (!available.length) return all[Math.floor(Math.random() * all.length)]; // phones: below the screen's bottom edge
    let roll = Math.random() * available.reduce((sum, [, weight]) => sum + weight, 0);
    const [chosen] = available.find(([, weight]) => (roll -= weight) < 0) ?? available.at(-1);
    return styles[chosen]();
  }
  const distance = ({ at }) => Math.hypot(at.out.x - near.x, at.out.y - near.y);
  return all.reduce((best, option) => (distance(option) < distance(best) ? option : best));
}

// How much of the robot to cut away at position p so it looks behind the section. It's linear in the position,
// so the cut and the movement animate in step (same duration and easing).
function clipFor({ box, side }, p) {
  const cut = (overlap) => `${Math.min(SIZE, Math.max(0, overlap))}px`;
  if (side === "left") return `inset(0 ${cut(p.x + SIZE - box.left)} 0 0)`;
  if (side === "right") return `inset(0 0 0 ${cut(box.right - p.x)})`;
  if (side === "top") return `inset(0 0 ${cut(p.y + SIZE - box.top)} 0)`;
  return `inset(${cut(box.bottom - p.y)} 0 0 0)`;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Shaking it while dragging: this many left-right turns within windowMs, each at least minStep px.
const SHAKE = { turns: 4, windowMs: 1000, minStep: 14 };

const ANSWER_STEPS = ["Search", "Found", "Think", "Write"];

// The speech bubble: what it's doing, plus a progress bar while embedding and the answer steps while answering.
// onClick: makes the bubble a button (the "z z z" while it naps: clicking it wakes the robot).
function Bubble({ state, badge, progress, step, side, onClick }) {
  if (!badge) return null;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      key={badge}
      {...(onClick && { type: "button", onClick, title: "Wake the robot", "aria-label": "Wake the robot" })}
      className={cn(
        "absolute top-2 w-max max-w-56 rounded-xl border bg-card/95 px-3 py-1.5 text-left text-[11px] font-semibold leading-snug shadow-lg backdrop-blur animate-in fade-in zoom-in-95 motion-reduce:animate-none",
        side === "left" ? "right-full mr-1" : "left-full ml-1",
        BADGE_TONE[state] ?? "border-glow/40 text-foreground",
        onClick && "pointer-events-auto cursor-pointer transition-colors hover:border-glow hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:animate-pulse",
      )}
    >
      {badge}
      {progress != null && (
        <span className="mt-1 block h-1 w-40 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-glow transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
      {step != null && (
        <span className="mt-1 flex gap-1.5 text-[9px] font-medium uppercase tracking-wide">
          {ANSWER_STEPS.map((name, index) => (
            <span key={name} className={cn(index < step ? "text-primary" : index === step ? "text-glow" : "text-muted-foreground/50")}>
              {index < step ? "✓" : index === step ? "●" : "○"} {name}
            </span>
          ))}
        </span>
      )}
    </Tag>
  );
}

// state, spot, badge, progress, step: from hooks/useRobot.js.
// onFiles(files): files dropped on the robot are uploaded, exactly like the shredder (canTakeFiles: not busy).
// summon: true while the export drawer is open; it comes beside the drawer even if you'd parked it elsewhere,
// and stays there until you drag it somewhere else.
export function AiRobot({ state, spot, badge, progress, step, summon, onFiles, canTakeFiles }) {
  const [position, setPosition] = useState(null);
  // Where you dropped it after dragging: its resting place between jobs. Any action takes it where the work is
  // (shredder, vault, chat…); afterwards it comes back here. Double-click to let it roam again.
  const [parked, setParked] = useState(null);
  // the parked place counts only while there's nothing to do (idle), or while it just keeps you company (assist)
  const restingAt = state === "idle" || state === "assist" ? parked : null;
  const [drag, setDrag] = useState(null); // { startX, startY, fromX, fromY, x, y, moved } while dragging
  const [fileOver, setFileOver] = useState(false);
  const [hint, setHint] = useState("");
  const [moving, setMoving] = useState(false);
  const previousSpot = useRef(null);

  // Hide and seek: { box, side, at, phase: "hidden" | "peek" | "out", jump, badge } while it plays.
  // jump = move there instantly (it's hidden, nobody sees it); otherwise it glides.
  const [hideout, setHideout] = useState(null);
  const [asleep, setAsleep] = useState(null); // null | "drowsy" (yawning) | "sleeping" (napping behind a section)
  const sequence = useRef(0); // bumping it cancels the running hide and seek
  const stop = () => sequence.current++;
  function play(steps) {
    const id = ++sequence.current;
    let time = 0;
    for (const [delay, action] of steps) {
      time += delay;
      setTimeout(() => sequence.current === id && action(), time);
    }
  }
  const phase = (name, badge = "") => setHideout((current) => current && { ...current, phase: name, jump: false, badge });
  const release = () => setHideout(null);

  // Surprise entrance: on page load it stays out of sight, then peeks out from a random hiding place and comes out.
  // The place is chosen when it appears, not at load, so the page (projects, chat header) is there to hide behind.
  useEffect(() => {
    setHideout({ ...pickHideout(), phase: "hidden", jump: true });
    if (reducedMotion()) play([[ROBOT_CONFIG.introDelayMs, release]]);
    else {
      play([
        [ROBOT_CONFIG.introDelayMs, () => setHideout({ ...pickHideout(), phase: "hidden", jump: true })],
        [80, () => phase("peek")],
        [ROBOT_CONFIG.peekMs, () => phase("out", "Boo! I'm your lab assistant")],
        [ROBOT_CONFIG.greetMs, release],
      ]);
    }
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While nothing happens, now and then it slips behind a random section and peeks out from another.
  const resting = state === "idle" && !parked && !drag && !hint && !fileOver && !hideout && !asleep;
  useEffect(() => {
    if (!resting || reducedMotion()) return;
    const timer = setTimeout(() => {
      setHideout({ ...pickHideout(), phase: "out", jump: false }); // walks up to a section's edge…
      play([
        [900, () => phase("hidden")], // …slips behind it…
        [ROBOT_CONFIG.hiddenMs, () => setHideout({ ...pickHideout(), phase: "hidden", jump: true })], // …moves unseen to another…
        [400, () => phase("peek", "Peekaboo!")], // …and peeks out
        [ROBOT_CONFIG.peekMs, () => phase("out")],
        [1200, release],
      ]);
    }, ROBOT_CONFIG.wanderEveryMs);
    return () => clearTimeout(timer);
  }, [resting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real work (an upload, a question, typing…) stops hide and seek: it comes out first, then goes to work.
  useEffect(() => {
    if (state === "idle" || !hideout) return;
    stop();
    setAsleep(null);
    setDizzy(false);
    napUntil.current = 0;
    if (hideout.phase === "out") return release();
    phase("out");
    const timer = setTimeout(release, 700);
    return () => clearTimeout(timer);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sleep.
  //   Auto:  with no mouse, keys, clicks, touch or scrolling for ROBOT_CONFIG.idleTimeoutMs it yawns, then naps
  //          behind the nearest section. Any activity wakes it. Never while it's working or being dragged.
  //   Shake: shake it while dragging and it gets dizzy and pops behind the nearest section. It ignores activity
  //          while it naps, then pops back out on its own after ROBOT_CONFIG.shakeNapMs (or as soon as work starts).
  const [dizzy, setDizzy] = useState(false);
  const napUntil = useRef(0); // until when activity can't wake it (after a shake)
  const live = useRef({});
  live.current = { state, asleep, dragging: !!drag, place: drag ?? hideout?.at[hideout.phase] ?? restingAt ?? position };

  function napNow(shaken) {
    stop();
    setHideout(null);
    setAsleep("drowsy");
    setDizzy(shaken);
    napUntil.current = shaken ? Date.now() + ROBOT_CONFIG.shakeNapMs : 0;
    const nap = pickHideout(live.current.place ?? undefined);
    const popOut = shaken ? [[ROBOT_CONFIG.shakeNapMs, () => actions.current.wakeUp("Pop! I'm back")]] : [];
    if (reducedMotion()) {
      setHideout({ ...nap, phase: "hidden", jump: true, badge: "z z z" });
      setAsleep("sleeping");
      play(popOut);
      return;
    }
    play([
      [shaken ? 1200 : ROBOT_CONFIG.sleepyMs, () => setHideout({ ...nap, phase: "out", jump: false, badge: "" })], // to the nearest edge…
      [900, () => {
        phase("hidden", "z z z"); // …and it pops behind it to nap
        setAsleep("sleeping");
      }],
      ...popOut,
    ]);
  }

  function wakeUp(greeting = "Hm? I'm up!") {
    stop();
    setAsleep(null);
    setDizzy(false);
    napUntil.current = 0;
    if (reducedMotion()) return release();
    phase("peek", greeting);
    play([[ROBOT_CONFIG.peekMs, () => phase("out")], [900, release]]);
  }

  const actions = useRef();
  actions.current = { napNow, wakeUp };
  useEffect(() => {
    let timer;
    let last = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(doze, ROBOT_CONFIG.idleTimeoutMs);
    };
    function doze() {
      const { state: now, dragging, asleep: sleeping } = live.current;
      if (sleeping) return;
      if (now !== "idle" || dragging) return arm(); // working: check again later
      actions.current.napNow(false);
    }
    function onActivity() {
      const now = Date.now();
      if (now - last < 300) return; // pointermove fires constantly: once every 300ms is plenty
      last = now;
      if (live.current.asleep && now > napUntil.current) actions.current.wakeUp(); // a shake nap ignores activity
      arm();
    }
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    for (const name of events) window.addEventListener(name, onActivity, { passive: true, capture: true });
    arm();
    return () => {
      clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, onActivity, { capture: true });
    };
  }, []);

  // Follow the spot: when it changes, on resize and scroll, and every second for layout shifts.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    let frame;
    function place() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPosition(inWindow(wide.matches ? spotPosition(spot) : corner())));
    }
    place();
    const interval = setInterval(place, 1000);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    wide.addEventListener("change", place);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      wide.removeEventListener("change", place);
    };
  }, [spot]);

  // Summoned (the export drawer opened): forget the old parking place so it comes over; dragging it re-parks it.
  useEffect(() => {
    if (summon) setParked(null);
  }, [summon]);

  // A parked robot stays inside the window when it's resized.
  useEffect(() => {
    if (!parked) return;
    const keepIn = () => setParked((current) => current && inWindow(current));
    window.addEventListener("resize", keepIn);
    return () => window.removeEventListener("resize", keepIn);
  }, [parked]);

  // While it glides somewhere new (a spot, or back to where you parked it): lean forward and light the thruster.
  const target = restingAt ? "parked" : spot;
  useEffect(() => {
    if (previousSpot.current === target) return;
    previousSpot.current = target;
    setMoving(true);
    const timer = setTimeout(() => setMoving(false), 800);
    return () => clearTimeout(timer);
  }, [target]);

  // A tip appears for a few seconds when you click it.
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(""), 3500);
    return () => clearTimeout(timer);
  }, [hint]);

  // Dragging with mouse, pen or touch. A press without movement is a click.
  function startDrag(event) {
    if (event.button !== 0) return;
    const from = drag ?? hideout?.at[hideout.phase] ?? restingAt ?? position;
    if (!from) return;
    stop(); // grabbing it ends hide and seek
    release();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, fromX: from.x, fromY: from.y, x: from.x, y: from.y, moved: false, lastX: event.clientX, dir: 0, turns: [] });
  }
  function moveDrag(event) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 4;
    const to = inWindow({ x: drag.fromX + dx, y: drag.fromY + dy });

    // shake detection: count quick left-right turns
    const now = Date.now();
    let { lastX, dir, turns } = drag;
    const stepX = event.clientX - lastX;
    if (Math.abs(stepX) >= SHAKE.minStep) {
      const nextDir = Math.sign(stepX);
      if (dir && nextDir !== dir) turns = [...turns.filter((time) => now - time < SHAKE.windowMs), now];
      dir = nextDir;
      lastX = event.clientX;
    }
    if (turns.length >= SHAKE.turns) {
      setParked(to); // it naps near where you shook it, and comes back here afterwards
      setDrag(null);
      napNow(true);
      return;
    }
    setDrag({ ...drag, ...to, moved, lastX, dir, turns });
  }
  function endDrag() {
    if (!drag) return;
    if (drag.moved) setParked({ x: drag.x, y: drag.y });
    else setHint(parked ? "I'll wait here between jobs · shake me to send me napping" : "Drag me anywhere · shake me to send me napping");
    setDrag(null);
  }

  // Files dropped on the robot go to the same upload as the shredder.
  function dropFiles(event) {
    event.preventDefault();
    setFileOver(false);
    const files = [...event.dataTransfer.files];
    if (files.length && canTakeFiles) onFiles(files);
  }

  const place = drag ?? hideout?.at[hideout.phase] ?? restingAt ?? position;
  if (!place) return null; // first measure happens right after mount
  const instant = drag || hideout?.jump;

  // Your actions come first: being dragged, or holding a file over it. Then hide and seek, then its work.
  const shownState = drag?.moved
    ? "listening"
    : fileOver
      ? "upload"
      : hideout?.phase === "peek"
        ? "listening"
        : asleep
          ? dizzy && asleep === "drowsy" ? "dizzy" : "sleepy"
          : hideout?.badge
            ? "found"
            : state;
  const shownBadge = drag?.moved
    ? "Wheee!"
    : fileOver
      ? canTakeFiles ? "Drop it, I'll shred it!" : "Busy, one moment…"
      : asleep === "drowsy" && !hideout
        ? dizzy ? "Whoa, so dizzy… nap time!" : "Yawn… nap time"
        : hideout
          ? hideout.badge
          : hint || badge;
  const side = place.x < 240 ? "right" : "left"; // keep the bubble on screen too

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-[60]", // above drawers and dialogs (z-50), so it can work beside the export drawer
        !instant && "transition-transform duration-700 ease-in-out motion-reduce:transition-none",
      )}
      style={{ transform: `translate3d(${place.x}px, ${place.y}px, 0)` }}
    >
      <span role="status" className="pointer-events-none">
        <Bubble
          state={shownState}
          badge={shownBadge}
          progress={drag || fileOver || hint ? null : progress}
          step={drag || fileOver || hint ? null : step}
          side={side}
          onClick={asleep === "sleeping" ? () => wakeUp("Hm? I'm up!") : undefined} // click the "z z z" to wake it
        />
      </span>
      <button
        type="button"
        data-robot // drawers treat touching the robot as inside, not "outside" (ExportSheet.jsx)
        aria-label="Lab robot. Drag to choose where it waits between jobs, shake it (or press Z) to send it napping, drop a file on it to upload, double-click to let it roam."
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={() => {
          setParked(null);
          setHint("Free to roam!");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setParked(null);
          if (event.key === "z") napNow(true); // the keyboard's way to "shake" it
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setFileOver(true);
        }}
        onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget) && setFileOver(false)}
        onDrop={dropFiles}
        // the cut that makes it look behind a section; it animates with the movement (same 700ms ease-in-out)
        style={{ width: SIZE, height: SIZE, clipPath: hideout ? clipFor(hideout, place) : "inset(0 0 0 0)" }}
        className={cn(
          // pointer-events-auto: an open drawer turns the pointer off for the page behind it; the robot stays grabbable
          "pointer-events-auto block touch-none select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !instant && "transition-[clip-path] duration-700 ease-in-out motion-reduce:transition-none",
          drag ? "cursor-grabbing" : "cursor-grab",
          fileOver && "drop-shadow-[0_0_14px_hsl(var(--glow))]",
        )}
      >
        <RobotDrawing state={shownState} moving={moving} />
      </button>
    </div>
  );
}
