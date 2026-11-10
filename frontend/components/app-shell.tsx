"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { AppProvider, useApp } from "@/lib/app-context";
import { workspaceProjectPath } from "@/lib/routes";

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    loading,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    selectedProject,
    projects,
    projectsLoaded,
    projectsWorkspaceId,
    projectsError,
    workspaceSelectionLoaded,
  } = useApp();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  React.useEffect(() => {
    if (loading || !user) return;

    if (!workspaceSelectionLoaded) return;

    if (!workspaces.length) {
      if (pathname !== "/workspaces/new") router.replace("/workspaces/new");
      return;
    }

    if (!projectsLoaded || projectsWorkspaceId !== selectedWorkspaceId) return;
    if (projectsError) return;

    if (!projects.length) {
      if (pathname !== "/projects/new") router.replace("/projects/new");
      return;
    }

    if (pathname.startsWith("/workspace/") && selectedWorkspace && selectedProject) {
      const selectedProjectPath = workspaceProjectPath(
        selectedWorkspace.slug,
        selectedProject.id,
      );
      if (pathname !== selectedProjectPath) {
        router.replace(selectedProjectPath);
        return;
      }
    }

    if (pathname === "/" && selectedWorkspace && selectedProject) {
      router.replace(
        workspaceProjectPath(selectedWorkspace.slug, selectedProject.id),
      );
      return;
    }

    if (isAuthPage) router.replace("/");
  }, [
    isAuthPage,
    loading,
    pathname,
    projects.length,
    projectsError,
    projectsLoaded,
    projectsWorkspaceId,
    router,
    selectedProject,
    selectedWorkspace,
    selectedWorkspaceId,
    user,
    workspaceSelectionLoaded,
    workspaces.length,
  ]);

  if (isAuthPage && (!user || loading)) return <>{children}</>;

  if (loading || !user) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </main>
    );
  }

  if (
    isAuthPage ||
    !workspaceSelectionLoaded ||
    !projectsLoaded ||
    projectsWorkspaceId !== selectedWorkspaceId
  ) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </main>
    );
  }

  if (projectsError && pathname === "/") {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/20">
        <p role="alert" className="text-sm text-destructive">
          Could not load your workspace projects: {projectsError}
        </p>
      </main>
    );
  }

  if (pathname === "/" && (!workspaces.length || !projects.length)) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Preparing your workspace…</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </main>
      }
    >
      <AppProvider>
        <ShellContent>{children}</ShellContent>
      </AppProvider>
    </React.Suspense>
  );
}
