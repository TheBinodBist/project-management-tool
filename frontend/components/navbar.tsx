"use client";

import * as React from "react";
import {
  ChevronRight,
  CircleHelp,
  Search,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { apiRequest, type WorkspaceMember } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NavbarProps {
  breadcrumb?: string[];
  title?: string;
  className?: string;
}

export function Navbar({
  breadcrumb,
  title,
  className,
}: NavbarProps) {
  const pathname = usePathname();
  const { projects, selectedProject, selectedWorkspace, selectedWorkspaceId } = useApp();
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const projectId = pathname.match(
    /^\/(?:projects|workspace\/[^/]+\/project)\/(\d+)$/,
  )?.[1];
  const activeProject = projects.find(
    (project) => project.id === Number(projectId),
  );
  const activeBreadcrumb =
    breadcrumb ??
    (activeProject
      ? [selectedWorkspace?.name ?? "Projects", activeProject.name]
      : selectedProject
        ? [selectedWorkspace?.name ?? "Projects", selectedProject.name]
      : selectedWorkspace
        ? ["Projects", selectedWorkspace.name]
        : ["Projects"]);
  const activeTitle =
    title ??
    activeProject?.name ??
    selectedProject?.name ??
    selectedWorkspace?.name ??
    "Projects";

  React.useEffect(() => {
    let active = true;
    async function loadMembers() {
      await Promise.resolve();
      if (!active) return;
      setMembers([]);
      setMembersError(null);
      if (!selectedWorkspaceId) return;

      try {
        setMembers(
          await apiRequest<WorkspaceMember[]>(
            `/workspaces/${selectedWorkspaceId}/members/`,
          ),
        );
      } catch (reason) {
        if (active) {
          setMembersError(
            reason instanceof Error
              ? reason.message
              : "Could not load workspace members.",
          );
        }
      }
    }
    void loadMembers();

    return () => {
      active = false;
    };
  }, [selectedWorkspaceId]);

  return (
    <header className={cn("bg-background", className)}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-6 border-b px-6 py-4">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {activeBreadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb}>
                {i > 0 && <ChevronRight className="size-3.5" />}
                <span
                  className={cn(i === activeBreadcrumb.length - 1 && "text-foreground")}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">
            {activeTitle}
          </h1>
        </div>

        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Find task..."
            className="h-12 rounded-xl pl-10 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full border bg-background py-1.5 pl-2 pr-1.5 shadow-sm">
            <div className="flex items-center -space-x-2">
              {members.slice(0, 4).map(({ user }) => (
                <Avatar key={user.id} className="size-8 border-2 border-background">
                  <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                  <AvatarFallback
                    className="bg-primary text-[11px] font-semibold text-primary-foreground"
                    aria-label={user.full_name}
                  >
                    {user.full_name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0] ?? "")
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 4 && (
                <Avatar className="size-8 border-2 border-background">
                  <AvatarFallback className="bg-muted text-xs font-semibold text-primary">
                    +{members.length - 4}
                  </AvatarFallback>
                </Avatar>
              )}
              {membersError && (
                <span role="alert" className="sr-only">
                  {membersError}
                </span>
              )}
            </div>
            <Button className="h-9 rounded-full px-5 shadow-md shadow-primary/30">
              Share
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Help"
            className="size-10 rounded-full"
          >
            <CircleHelp className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;