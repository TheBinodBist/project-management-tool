"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WorkspaceForm() {
  const router = useRouter();
  const { createWorkspace } = useApp();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createWorkspace(name.trim(), description.trim());
      router.push("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>
      <h2 className="mt-6 text-2xl font-semibold">Create a workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Start a shared space for a team, organization, or area of work.
      </p>

      <form
        className="mt-8 space-y-5 rounded-2xl border bg-background p-6"
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2 text-sm font-medium">
          Workspace name
          <Input
            required
            maxLength={120}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Product team"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this workspace for?"
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push("/")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </form>
    </section>
  );
}
