"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  apiRequest,
  clearTokens,
  getAccessToken,
  loginRequest,
  Project,
  registerRequest,
  saveTokens,
  Workspace,
  ApiUser,
} from "@/lib/api";

type AppContextValue = {
  user: ApiUser | null;
  workspaces: Workspace[];
  projects: Project[];
  projectsLoading: boolean;
  projectsLoaded: boolean;
  projectsWorkspaceId: number | null;
  selectedProjectId: number | null;
  selectedProject: Project | null;
  projectsError: string | null;
  workspaceSelectionLoaded: boolean;
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: number | null;
  loading: boolean;
  projectSearch: string;
  setProjectSearch: (value: string) => void;
  selectWorkspace: (id: number) => void;
  selectProject: (id: number, workspaceId?: number | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  createWorkspace: (name: string, description: string) => Promise<Workspace>;
  createProject: (name: string, description: string) => Promise<Project>;
  refreshProjects: () => Promise<void>;
};

const AppContext = React.createContext<AppContextValue | null>(null);
const SELECTED_WORKSPACE_KEY = "project-workspace.selected-workspace";
const selectedProjectKey = (workspaceId: number) =>
  `project-workspace.selected-project.${workspaceId}`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [projectsLoaded, setProjectsLoaded] = React.useState(false);
  const [projectsWorkspaceId, setProjectsWorkspaceId] = React.useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState<number | null>(null);
  const [projectsError, setProjectsError] = React.useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<number | null>(null);
  const [workspaceSelectionLoaded, setWorkspaceSelectionLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [projectSearch, setProjectSearch] = React.useState("");
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const projectRequestId = React.useRef(0);

  const loadWorkspaces = React.useCallback(async (routeSlug?: string) => {
    const result = await apiRequest<Workspace[]>("/workspaces/");
    const saved = window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
    const preferred = saved ? Number(saved) : null;
    const routeWorkspace = result.find((workspace) => workspace.slug === routeSlug);
    const next = routeWorkspace?.id ??
      (result.some((workspace) => workspace.id === preferred)
        ? preferred
        : result[0]?.id ?? null);

    setWorkspaces(result);
    setSelectedWorkspaceId(next);
    if (next === null) window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
    else window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(next));
    setWorkspaceSelectionLoaded(true);
  }, []);

  React.useEffect(() => {
    let active = true;

    async function initialize() {
      if (!getAccessToken()) {
        if (active) {
          setUser(null);
          setLoading(false);
          if (!isAuthPage) router.replace("/login");
        }
        return;
      }

      try {
        const currentUser = await apiRequest<ApiUser>("/auth/me/");
        if (!active) return;
        setUser(currentUser);
        const routeSlug = window.location.pathname.match(
          /^\/workspace\/([^/]+)\/project\/\d+$/,
        )?.[1];
        await loadWorkspaces(routeSlug);
      } catch {
        if (!active) return;
        clearTokens();
        setUser(null);
        if (!isAuthPage) router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [isAuthPage, loadWorkspaces, router]);

  React.useEffect(() => {
    let active = true;
    const requestId = ++projectRequestId.current;
    async function loadProjects() {
      if (!user || !workspaceSelectionLoaded) return;

      if (!selectedWorkspaceId) {
        if (active && requestId === projectRequestId.current) {
          setProjects([]);
          setProjectsError(null);
          setProjectsLoading(false);
          setProjectsLoaded(true);
          setProjectsWorkspaceId(null);
          setSelectedProjectId(null);
        }
        return;
      }
      setProjectsLoading(true);
      setProjectsLoaded(false);
      setProjectsError(null);
      try {
        const result = await apiRequest<Project[]>(
          `/projects/?workspace=${selectedWorkspaceId}`,
        );
        if (active && requestId === projectRequestId.current) {
          setProjects(result);
          const savedProjectId = window.localStorage.getItem(
            selectedProjectKey(selectedWorkspaceId),
          );
          const preferredProjectId = savedProjectId ? Number(savedProjectId) : null;
          const routeProjectId = window.location.pathname.match(
            /^\/workspace\/[^/]+\/project\/(\d+)$/,
          )?.[1];
          const routeProject = routeProjectId
            ? Number(routeProjectId)
            : null;
          const nextProjectId = result.some(
            (project) => project.id === routeProject,
          )
            ? routeProject
            : result.some((project) => project.id === preferredProjectId)
              ? preferredProjectId
              : result[0]?.id ?? null;
          setSelectedProjectId(nextProjectId);
          if (nextProjectId === null) {
            window.localStorage.removeItem(selectedProjectKey(selectedWorkspaceId));
          } else {
            window.localStorage.setItem(
              selectedProjectKey(selectedWorkspaceId),
              String(nextProjectId),
            );
          }
          setProjectsLoaded(true);
          setProjectsWorkspaceId(selectedWorkspaceId);
        }
      } catch (error) {
        if (active && requestId === projectRequestId.current) {
          setProjects([]);
          setProjectsError(
            error instanceof Error ? error.message : "Could not load projects.",
          );
          setProjectsLoaded(true);
          setProjectsWorkspaceId(selectedWorkspaceId);
          setSelectedProjectId(null);
        }
      } finally {
        if (active && requestId === projectRequestId.current) {
          setProjectsLoading(false);
        }
      }
    }
    void loadProjects();
    return () => {
      active = false;
    };
  }, [selectedWorkspaceId, user, workspaceSelectionLoaded]);

  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  const selectWorkspace = React.useCallback((id: number) => {
    projectRequestId.current += 1;
    setProjectsLoaded(false);
    setSelectedWorkspaceId(id);
    setSelectedProjectId(null);
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(id));
  }, []);

  const selectProject = React.useCallback(
    (id: number, workspaceId = selectedWorkspaceId) => {
      setSelectedProjectId(id);
      if (workspaceId) {
        window.localStorage.setItem(selectedProjectKey(workspaceId), String(id));
      }
    },
    [selectedWorkspaceId],
  );
  const acceptTokens = React.useCallback(
    async (tokens: { access: string; refresh: string; user: ApiUser }) => {
      saveTokens(tokens);
      setUser(tokens.user);
      setLoading(true);
      try {
        await loadWorkspaces();
        router.replace("/");
      } catch (error) {
        clearTokens();
        setUser(null);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadWorkspaces, router],
  );

  const login = React.useCallback(
    async (email: string, password: string) => {
      await acceptTokens(await loginRequest(email, password));
    },
    [acceptTokens],
  );

  const register = React.useCallback(
    async (email: string, name: string, password: string) => {
      await acceptTokens(await registerRequest(email, name, password));
    },
    [acceptTokens],
  );

  const logout = React.useCallback(() => {
    clearTokens();
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setProjectsLoaded(false);
    setProjectsWorkspaceId(null);
    setSelectedProjectId(null);
    window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
    router.replace("/login");
  }, [router]);

  const createWorkspace = React.useCallback(
    async (name: string, description: string) => {
      const workspace = await apiRequest<Workspace>("/workspaces/", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setWorkspaces((current) => [...current, workspace]);
      selectWorkspace(workspace.id);
      return workspace;
    },
    [selectWorkspace],
  );

  const createProject = React.useCallback(
    async (name: string, description: string) => {
      if (!selectedWorkspaceId) throw new Error("Select a workspace first.");
      const project = await apiRequest<Project>("/projects/", {
        method: "POST",
        body: JSON.stringify({
          workspace: selectedWorkspaceId,
          name,
          description,
        }),
      });
      try {
        await apiRequest("/boards/", {
          method: "POST",
          body: JSON.stringify({
            project: project.id,
            name: project.name,
            create_default_columns: true,
          }),
        });
      } catch (error) {
        projectRequestId.current += 1;
        setProjects((current) => [...current, project]);
        setProjectsLoaded(true);
        setProjectsWorkspaceId(selectedWorkspaceId);
        setSelectedProjectId(project.id);
        window.localStorage.setItem(
          selectedProjectKey(selectedWorkspaceId),
          String(project.id),
        );
        const message =
          error instanceof Error ? error.message : "Could not create the project board.";
        throw new Error(`Project created, but its board could not be initialized: ${message}`);
      }
      projectRequestId.current += 1;
      setProjects((current) =>
        current.some((existing) => existing.id === project.id)
          ? current
          : [...current, project],
      );
      setProjectsLoaded(true);
      setProjectsWorkspaceId(selectedWorkspaceId);
      setSelectedProjectId(project.id);
      window.localStorage.setItem(
        selectedProjectKey(selectedWorkspaceId),
        String(project.id),
      );
      return project;
    },
    [selectedWorkspaceId],
  );

  const refreshProjects = React.useCallback(async () => {
    if (!selectedWorkspaceId) {
      projectRequestId.current += 1;
      setProjects([]);
      setProjectsLoaded(true);
      setProjectsWorkspaceId(null);
      setSelectedProjectId(null);
      return;
    }
    const requestId = ++projectRequestId.current;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await apiRequest<Project[]>(
        `/projects/?workspace=${selectedWorkspaceId}`,
      );
      if (requestId === projectRequestId.current) {
        setProjects(result);
        setProjectsLoaded(true);
        setProjectsWorkspaceId(selectedWorkspaceId);
        const savedProjectId = window.localStorage.getItem(
          selectedProjectKey(selectedWorkspaceId),
        );
        const preferredProjectId = savedProjectId ? Number(savedProjectId) : null;
        const nextProjectId = result.some(
          (project) => project.id === preferredProjectId,
        )
          ? preferredProjectId
          : result[0]?.id ?? null;
        setSelectedProjectId(nextProjectId);
        if (nextProjectId !== null) {
          window.localStorage.setItem(
            selectedProjectKey(selectedWorkspaceId),
            String(nextProjectId),
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load projects.";
      if (requestId === projectRequestId.current) {
        setProjectsError(message);
        setProjectsLoaded(true);
        setProjectsWorkspaceId(selectedWorkspaceId);
      }
    } finally {
      if (requestId === projectRequestId.current) setProjectsLoading(false);
    }
  }, [selectedWorkspaceId]);

  const value = React.useMemo(
    () => ({
      user,
      workspaces,
      projects,
      projectsLoading,
      projectsLoaded,
      projectsWorkspaceId,
      selectedProjectId,
      selectedProject,
      projectsError,
      workspaceSelectionLoaded,
      selectedWorkspace,
      selectedWorkspaceId,
      loading,
      projectSearch,
      setProjectSearch,
      selectWorkspace,
      selectProject,
      login,
      register,
      logout,
      createWorkspace,
      createProject,
      refreshProjects,
    }),
    [
      user,
      workspaces,
      projects,
      projectsLoading,
      projectsLoaded,
      projectsWorkspaceId,
      selectedProjectId,
      selectedProject,
      projectsError,
      workspaceSelectionLoaded,
      selectedWorkspace,
      selectedWorkspaceId,
      loading,
      projectSearch,
      selectWorkspace,
      selectProject,
      login,
      register,
      logout,
      createWorkspace,
      createProject,
      refreshProjects,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = React.useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider.");
  return context;
}
