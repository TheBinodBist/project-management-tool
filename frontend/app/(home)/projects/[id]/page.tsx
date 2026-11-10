"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";

import { apiRequest, Project } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = React.useState<Project | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadProject() {
      try {
        const result = await apiRequest<Project>(`/projects/${id}/`);
        if (active) setProject(result);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load project.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProject();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workspace
      </Link>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading project…</p>
      ) : error ? (
        <div className="mt-8 rounded-xl border bg-background p-6">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" variant="outline" render={<Link href="/" />}>
            Return to workspace
          </Button>
        </div>
      ) : project ? (
        <>
          <div className="mt-8 flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="size-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Project</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                {project.name}
              </h1>
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-muted-foreground">
                {project.description || "No description has been added."}
              </p>
            </div>
          </div>
          <div className="mt-10 rounded-2xl border border-dashed bg-background px-6 py-12 text-center">
            <h2 className="font-semibold">Project created</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Boards and tasks can be added to this project next.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
