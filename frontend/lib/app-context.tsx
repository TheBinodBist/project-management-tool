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
  projectsError: string | null;
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: number | null;
  loading: boolean;
  projectSearch: string;
  setProjectSearch: (value: string) => void;
  selectWorkspace: (id: number) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  createWorkspace: (name: string, description: string) => Promise<Workspace>;
  createProject: (name: string, description: string) => Promise<Project>;
  refreshProjects: () => Promise<void>;
};

const AppContext = React.createContext<AppContextValue | null>(null);
const SELECTED_WORKSPACE_KEY = "project-workspace.selected-workspace";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [projectsError, setProjectsError] = React.useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [projectSearch, setProjectSearch] = React.useState("");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  const loadWorkspaces = React.useCallback(async () => {
    const result = await apiRequest<Workspace[]>("/workspaces/");
    setWorkspaces(result);
    setSelectedWorkspaceId((current) => {
      const saved = window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
      const preferred = current ?? (saved ? Number(saved) : null);
      const next = result.some((workspace) => workspace.id === preferred)
        ? preferred
        : result[0]?.id ?? null;
      if (next === null) window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
      else window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(next));
      return next;
    });
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
        await loadWorkspaces();
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
  }, [isAuthPage, loadWorkspaces, pathname, router]);

  React.useEffect(() => {
    let active = true;
    async function loadProjects() {
      if (!user || !selectedWorkspaceId) {
        setProjects([]);
        setProjectsError(null);
        setProjectsLoading(false);
        return;
      }
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const result = await apiRequest<Project[]>(
          `/projects/?workspace=${selectedWorkspaceId}`,
        );
        if (active) setProjects(result);
      } catch (error) {
        if (active) {
          setProjectsError(
            error instanceof Error ? error.message : "Could not load projects.",
          );
        }
      } finally {
        if (active) setProjectsLoading(false);
      }
    }
    void loadProjects();
    return () => {
      active = false;
    };
  }, [selectedWorkspaceId, user]);

  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;

  const selectWorkspace = React.useCallback((id: number) => {
    setSelectedWorkspaceId(id);
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(id));
  }, []);

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
      setProjects((current) => [...current, project]);
      return project;
    },
    [selectedWorkspaceId],
  );

  const refreshProjects = React.useCallback(async () => {
    if (!selectedWorkspaceId) {
      setProjects([]);
      return;
    }
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await apiRequest<Project[]>(
        `/projects/?workspace=${selectedWorkspaceId}`,
      );
      setProjects(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load projects.";
      setProjectsError(message);
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedWorkspaceId]);

  const value = React.useMemo(
    () => ({
      user,
      workspaces,
      projects,
      projectsLoading,
      projectsError,
      selectedWorkspace,
      selectedWorkspaceId,
      loading,
      projectSearch,
      setProjectSearch,
      selectWorkspace,
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
      projectsError,
      selectedWorkspace,
      selectedWorkspaceId,
      loading,
      projectSearch,
      selectWorkspace,
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
