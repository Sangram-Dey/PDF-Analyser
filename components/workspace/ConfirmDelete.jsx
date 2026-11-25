"use client";

import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

// A trash icon button that asks before deleting. Used for projects and documents.
// loading: the delete is running (the dialog has closed), so the button spins until it finishes.
export function ConfirmDelete({ label, title, description, disabled, loading = false, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={loading ? "Deleting…" : label}
          aria-label={loading ? "Deleting…" : label}
          aria-busy={loading}
          disabled={disabled || loading}
          className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {loading ? <Loader2 className="animate-spin text-destructive motion-reduce:animate-none" /> : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={buttonVariants({ variant: "destructive" })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
