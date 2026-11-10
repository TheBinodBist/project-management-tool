"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { BoardView } from "@/components/board/board-view";
import { useApp } from "@/lib/app-context";
import { apiRequest, type Project } from "@/lib/api";
import { workspaceProjectPath } from "@/lib/routes";

export function ProjectBoardPage() {
  const router = useRouter();
  const params = useParams<{ id?: string; projectId?: string; workspaceSlug?: string }>();
  const projectId = params.projectId ?? params.id;
  const workspaceSlug = params.workspaceSlug;
  const {
    selectProject,
    selectWorkspace,
    selectedWorkspaceId,
    workspaceSelectionLoaded,
    workspaces,
  } = useApp();
  const [project, setProject] = React.useState<Project | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadProject() {
      if (!workspaceSelectionLoaded || !projectId) return;

      try {
        const result = await apiRequest<Project>(`/projects/${projectId}/`);
        const workspace = workspaces.find(
          (item) =>
            item.id === result.workspace &&
            (!workspaceSlug || item.slug === workspaceSlug),
        );
        if (!workspace) {
          throw new Error("This project does not belong to that workspace.");
        }
        if (!active) return;
        if (selectedWorkspaceId !== workspace.id) {
          selectWorkspace(workspace.id);
        }
        selectProject(result.id, workspace.id);
        setProject(result);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Could not load project.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProject();
    return () => {
      active = false;
    };
  }, [
    projectId,
    selectProject,
    selectWorkspace,
    selectedWorkspaceId,
    workspaceSelectionLoaded,
    workspaceSlug,
    workspaces,
  ]);

  React.useEffect(() => {
    if (workspaceSlug || !project) return;
    const workspace = workspaces.find((item) => item.id === project.workspace);
    if (workspace) {
      router.replace(workspaceProjectPath(workspace.slug, project.id));
    }
  }, [project, router, workspaceSlug, workspaces]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading project…</p>;
  }
  if (error) {
    return <p role="alert" className="p-6 text-sm text-destructive">{error}</p>;
  }
  if (!project) return null;

  return (
    <BoardView
      projectId={project.id}
      heading={project.name}
      description={project.description || "Project tasks"}
    />
  );
}
