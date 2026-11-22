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
import {
  apiRequest,
  inviteWorkspaceMember,
  type WorkspaceMember,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [shareOpen, setShareOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteSent, setInviteSent] = React.useState<string | null>(null);
  const [membersRefresh, setMembersRefresh] = React.useState(0);
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
  }, [membersRefresh, selectedWorkspaceId]);

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspaceId) return;
    setInviting(true);
    setInviteError(null);
    setInviteSent(null);
    try {
      const invitation = await inviteWorkspaceMember(
        selectedWorkspaceId,
        inviteEmail.trim(),
      );
      setInviteSent(`Invitation sent to ${invitation.email}.`);
      setInviteEmail("");
      setMembersRefresh((current) => current + 1);
    } catch (reason) {
      setInviteError(
        reason instanceof Error ? reason.message : "Could not send invitation.",
      );
    } finally {
      setInviting(false);
    }
  }

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
            <Button
              className="h-9 rounded-full px-5 shadow-md shadow-primary/30"
              disabled={!selectedWorkspaceId}
              onClick={() => {
                setInviteError(null);
                setInviteSent(null);
                setShareOpen(true);
              }}
            >
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
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {selectedWorkspace?.name ?? "workspace"}</DialogTitle>
            <DialogDescription>
              Invite teammates by email. They can join after accepting the emailed link.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void sendInvitation(event)}>
            <label className="block space-y-2 text-sm font-medium">
              Email address
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
              />
            </label>
            {inviteError && (
              <p role="alert" className="text-sm text-destructive">
                {inviteError}
              </p>
            )}
            {inviteSent && (
              <p role="status" className="text-sm text-green-700">
                {inviteSent}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={inviting}>
              {inviting ? "Sending invitation…" : "Send invitation"}
            </Button>
          </form>
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Workspace members</h3>
            {membersError ? (
              <p role="alert" className="text-sm text-destructive">
                {membersError}
              </p>
            ) : members.length ? (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {members.map(({ id, user, role }) => (
                  <li key={id} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {user.full_name || user.email}
                      <span className="ml-2 text-muted-foreground">{user.email}</span>
                    </span>
                    <span className="ml-3 shrink-0 capitalize text-muted-foreground">
                      {role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No members found for this workspace.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export default Navbar;