"use client";

import { useEffect, useRef, useState } from "react";

// Everything you might want to tune about the lab robot, in one place.
export const ROBOT_CONFIG = {
  size: 112, // px: how big the robot is on screen
  reactionMs: { complete: 2200, found: 1400, ready: 2000, explore: 2600, read: 2600, lock: 900, assist: 3000 }, // how long a short reaction plays
  vaultLockMs: 900, // the chat's vault stays locked this long before the answer shows (VaultLoader); the robot's "lock" matches it
  // Hide and seek (components/workspace/AiRobot.jsx): it tucks behind sections marked data-robot-hide.
  introDelayMs: 3000, // on page load it stays hidden this long, then peeks out from a random section
  peekMs: 1400, // how long it peeks before coming out
  greetMs: 2600, // how long it lingers by its hiding place after coming out
  wanderEveryMs: 20000, // while idle, it goes to hide behind a random section this often…
  hiddenMs: 2500, // …stays hidden this long, then peeks out from another one
  // How often each way of hiding is picked for the entrance and hide-and-seek (relative weights; 0 turns one off):
  // behind a main section's edge, down from behind the "Ask your documents" header, up from behind it,
  // or in from the right edge near the bottom-right corner.
  hideStyles: { sections: 3, dropDown: 2, popUp: 2, corner: 2 },
  // Sleep: no mouse, keys, clicks, touch or scrolling for idleTimeoutMs → it yawns, then naps behind a nearby section.
  // Any activity wakes it. It never sleeps while it's working (upload, answer, typing) or being dragged.
  idleTimeoutMs: 30_000, // e.g. 60_000 for one minute
  sleepyMs: 2500, // how long it yawns before going to hide
  shakeNapMs: 45_000, // shaken while dragging: it naps behind a section this long (activity won't wake it), then pops out
};

// What the lab robot does and where it goes (components/workspace/AiRobot.jsx), from real app events only.
//
// Summaries: while one is made it works by the file list with its magnifier ("extract"), then says "Summary ready".
//
//   state       idle | assist | listening | explore | read | upload | processing | extract | pack | complete | retrieval | found
//               | thinking | lock | answering | ready | error
//   summon      true while the export drawer is open: the robot comes to assist beside it (until you drag it away)
//   spot        projects (the project list) | documents (the file list) | shredder | vault (the chat's loader) | chat (the question box)
//               | export, export-extract, export-download (beside the export drawer: its top, results, download buttons)
//               | header (the project header)
//   badge       its speech bubble: real names and counts only
//   progress    0–1 while an upload is embedding/saving (real done / total), for the bubble's progress bar
//   step        0–4 while answering: search, found, think, write, done (for the bubble's step dots)
//
// Live states follow the upload stream and the answer stream. Short reactions play once, right after a real event:
// "complete" (a file was indexed), "found" (sources arrived), "ready" (answer done), and the ones the page cues
// for your own actions: "explore" (you picked a project), "read" (you picked or opened a document).
//
// Returns [robot, cue]: cue(state, spot, badge) plays a reaction for an action you just took.

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// task: the app's busy label (hooks/useWorkspace.js): "export", "download", "project-delete", a document id while deleting…
// deletingName: the name of the file being deleted, if any.
export function useRobot({ projectId, vectors, uploading, uploadProgress, answering, latest, typing, error, task, deletingName, exportOpen, summarizing, summarized }) {
  const [reaction, setReaction] = useState(null); // { state, spot, badge, step } while a reaction plays
  const [rest, setRest] = useState("chat"); // where it waits when idle: by the files after an upload, by the chat after an answer
  const timer = useRef();

  function react(state, spot, badge, restAfter, step) {
    clearTimeout(timer.current);
    setReaction({ state, spot, badge, step });
    if (restAfter) setRest(restAfter);
    timer.current = setTimeout(() => setReaction(null), ROBOT_CONFIG.reactionMs[state]);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  // A file was indexed: the project's stored vector count went up.
  const previous = useRef({ projectId, vectors });
  useEffect(() => {
    const before = previous.current;
    previous.current = { projectId, vectors };
    if (before.projectId === projectId && vectors > before.vectors) react("complete", "shredder", "Indexed! Ready for questions", "documents");
  }, [projectId, vectors]); // eslint-disable-line react-hooks/exhaustive-deps

  // The answer stream: sources arrived (searching → reading), and the answer finished (writing → done).
  const stage = latest?.stage;
  const previousStage = useRef(stage);
  useEffect(() => {
    const before = previousStage.current;
    previousStage.current = stage;
    if (stage === "reading" && before === "searching") react("found", "vault", `Found ${plural(latest.sources?.length ?? 0, "paper")}!`, null, 1);
    if (stage === "writing" && before !== "writing") react("lock", "vault", "Locking the vault", null, 3); // the first words: the vault shuts
    if (!stage && before === "writing") react("ready", "chat", "Answer ready", "chat", 4);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // The export drawer opened: it comes over and offers to help (then it waits there quietly, "assist").
  useEffect(() => {
    if (exportOpen) react("assist", "export", "Pick the fields and I'll find them");
  }, [exportOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export and delete finished (the app went from that task back to idle, without an error): a short reaction.
  const deleted = useRef("");
  if (deletingName) deleted.current = deletingName; // remembered, because the file is gone once the delete finishes
  const previousTask = useRef(task);
  useEffect(() => {
    const before = previousTask.current;
    previousTask.current = task;
    if (task || error || !before) return;
    if (before === "export") react("complete", "export-extract", "Fields extracted · review them");
    else if (before === "download") react("ready", "export-download", "File downloaded");
    else if (before === "project-delete") react("complete", "projects", "Project removed");
    else if (deleted.current) react("complete", "documents", `${deleted.current} removed`, "documents");
    deleted.current = "";
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  // A summary finished.
  useEffect(() => {
    if (summarized) react("complete", "documents", `Summary of ${summarized.name} ready`, "documents");
  }, [summarized?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Your own actions (picking a project or a document) cue a reaction, unless real work is running.
  const working = uploading.length > 0 || answering || !!task || !!summarizing;
  const cue = (state, spot, badge) => !working && react(state, spot, badge, spot === "documents" ? "documents" : null);

  const robot = (() => {
    if (error) return { state: "error", spot: reaction?.spot ?? rest, badge: "Something went wrong" };
    if (reaction) return reaction;

    if (uploading.length) {
      const { stage: upload, done = 0, total = 0, parts, unit } = uploadProgress;
      if (!upload || upload === "uploading") return { state: "upload", spot: "shredder", badge: `Inspecting ${uploading[0]}` };
      const badge = {
        reading: "Reading the pages",
        splitting: parts ? `${plural(parts, unit)} read · shredding` : "Shredding",
        embedding: `Embedding ${done} / ${total}`,
        saving: "Saving the index",
      }[upload];
      const progress = upload === "saving" ? 1 : upload === "embedding" && total ? done / total : null;
      return { state: "processing", spot: "shredder", badge, progress };
    }

    if (answering) {
      // no stage on this screen = the answer streaming belongs to another file (you switched): still answering
      // the robot works the chat's vault: opens it and scans the papers, then carries off the ones it found
      if (stage === "searching") return { state: "retrieval", spot: "vault", badge: "Opening the vault · searching the papers", step: 0 };
      if (stage === "reading") return { state: "thinking", spot: "vault", badge: `Picked up ${plural(latest.sources?.length ?? 0, "paper")} · thinking`, step: 2 };
      return { state: "answering", spot: "chat", badge: "Writing the answer", step: stage === "writing" ? 3 : undefined };
    }

    if (summarizing) {
      const { stage: step, done = 0, total = 0, name } = summarizing;
      const badge =
        step === "combining" ? "Putting the parts together"
          : step === "summarizing" && total > 1 ? `Summarizing part ${done + 1} of ${total}`
            : step === "summarizing" ? `Summarizing ${name}`
              : `Reading ${name}`;
      const progress = step === "combining" ? 0.95 : step === "summarizing" && total > 1 ? done / total : null;
      return { state: "extract", spot: "documents", badge, progress };
    }

    // export and delete: it goes to where it happens and works there
    // in the export drawer it works where the action is: by the results while extracting, by the buttons while packing
    if (task === "export") return { state: "extract", spot: "export-extract", badge: "Scanning the file for your fields" }; // magnifier
    if (task === "download") return { state: "pack", spot: "export-download", badge: "Packing your file into a box" }; // carries a box
    if (task === "project-delete") return { state: "processing", spot: "header", badge: "Clearing out this project" };
    if (deletingName) return { state: "processing", spot: "documents", badge: `Shredding ${deletingName}` };

    if (typing) return { state: "listening", spot: "chat", badge: "Listening…" };
    if (exportOpen) return { state: "assist", spot: "export", badge: "" }; // waits beside the drawer
    return { state: "idle", spot: rest, badge: "" };
  })();

  return [{ ...robot, summon: !!exportOpen }, cue];
}
