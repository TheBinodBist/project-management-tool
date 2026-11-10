"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectForm() {
  const router = useRouter();
  const { createProject, selectedWorkspace } = useApp();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createProject(name.trim(), description.trim());
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create project.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedWorkspace) {
    return (
      <section className="mx-auto max-w-xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Choose a workspace first</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Projects belong to a workspace. Create or select one before adding a project.
        </p>
        <Button
          className="mt-5"
          nativeButton={false}
          render={<Link href="/workspaces/new" />}
        >
          Create workspace
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {selectedWorkspace.name}
      </Link>
      <h2 className="mt-6 text-2xl font-semibold">Create a project</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Add a project to <span className="font-medium text-foreground">{selectedWorkspace.name}</span>.
      </p>

      <form
        className="mt-8 space-y-5 rounded-2xl border bg-background p-6"
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2 text-sm font-medium">
          Project name
          <Input
            required
            maxLength={120}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Website redesign"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should this project accomplish?"
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
            {submitting ? "Creating…" : "Create project"}
          </Button>
        </div>
      </form>
    </section>
  );
}
