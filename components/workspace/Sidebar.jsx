"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { FileText, Folder, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar({ projects, selectedId, busy, loading, onSelect, onCreate }) {
  const [name, setName] = useState("");
  const creating = busy === "project";

  async function submit(event) {
    event.preventDefault();
    if (name.trim() && (await onCreate(name))) setName("");
  }

  return (
    <aside data-robot-hide className="flex w-full flex-col bg-sidebar p-3 text-sidebar-foreground sm:w-64 sm:shrink-0 sm:p-4 sm:pt-7">
      <div className="flex items-center gap-2.5 px-2 pb-3 text-lg font-bold sm:pb-9">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-glow">
          <FileText className="size-4 text-primary-foreground" />
        </span>
        Sourcework
      </div>

      <p className="hidden px-3 pb-3 text-[10px] font-bold tracking-widest text-sidebar-muted sm:block">PROJECTS</p>
      <nav aria-label="Projects" aria-busy={loading} data-robot-spot="projects" className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-y-auto">
        {/* While the projects load: three placeholder rows that pulse */}
        {loading &&
          [70, 55, 80].map((width) => (
            <span key={width} aria-hidden="true" className="flex h-10 min-w-36 items-center gap-2.5 px-3 sm:min-w-0">
              <span className="size-4 shrink-0 rounded bg-sidebar-active motion-safe:animate-pulse" />
              <span className="h-2.5 rounded-full bg-sidebar-active motion-safe:animate-pulse" style={{ width: `${width}%` }} />
            </span>
          ))}
        {projects.map((project) => {
          const active = project.id === selectedId;
          return (
            <Button
              key={project.id}
              variant="ghost"
              onClick={() => onSelect(project.id)}
              disabled={!!busy}
              aria-current={active ? "page" : undefined}
              className={cn(
                "h-10 min-w-36 justify-start gap-2.5 px-3 font-normal text-sidebar-muted hover:bg-sidebar-active hover:text-white sm:min-w-0",
                active && "bg-sidebar-active text-white",
              )}
            >
              <Folder className="shrink-0" />
              <span className="flex-1 truncate text-left">{project.name}</span>
              <span className="text-xs">{project.documents.length}</span>
            </Button>
          );
        })}
      </nav>

      <form onSubmit={submit} className="mt-3 flex gap-1.5 sm:mt-4">
        <Input
          aria-label="New project name"
          placeholder="New project name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          className="border-sidebar-muted/40 text-white placeholder:text-sidebar-muted"
        />
        <Button
          type="submit"
          size="icon"
          title={creating ? "Creating…" : "Create project"}
          aria-label={creating ? "Creating project…" : "Create project"}
          aria-busy={creating}
          disabled={!!busy || !name.trim()}
          className="shrink-0"
        >
          {creating ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Plus />}
        </Button>
      </form>

      {/* Clerk's account menu (avatar + name, "Manage account", "Sign out") and the light/dark switch */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-active px-2 pt-3 sm:mt-auto sm:pt-4">
        <span className="hidden sm:block">
          <UserButton
            showName
            appearance={{ elements: { userButtonBox: "flex-row-reverse", userButtonOuterIdentifier: "text-sm text-sidebar-foreground" } }}
          />
        </span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
