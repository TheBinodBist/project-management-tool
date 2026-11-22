"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { apiRequest, type WorkspaceInvitation } from "@/lib/api";

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: appLoading, acceptInvitation, logout } = useApp();
  const [invitation, setInvitation] =
    React.useState<WorkspaceInvitation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function loadInvitation() {
      try {
        const result = await apiRequest<WorkspaceInvitation>(
          `/invitations/${token}/`,
        );
        if (active) setInvitation(result);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Could not load invitation.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInvitation();
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptInvitation(token);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not accept invitation.",
      );
    } finally {
      setAccepting(false);
    }
  }

  const invitationQuery = new URLSearchParams({ invite: token });
  if (invitation) invitationQuery.set("email", invitation.email);
  const inviteUrl = `/login?${invitationQuery.toString()}`;
  const registerUrl = `/register?${invitationQuery.toString()}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border bg-background p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">Project Workspace</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Workspace invitation
        </h1>
        {loading || appLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Loading invitation…
          </p>
        ) : error && !invitation ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : invitation ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              {invitation.invited_by_name || "A teammate"} invited{" "}
              <strong className="text-foreground">{invitation.email}</strong> to
              join <strong className="text-foreground">{invitation.workspace_name}</strong>{" "}
              as a {invitation.role}.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Invitation expires {new Date(invitation.expires_at).toLocaleString()}.
            </p>

            {invitation.accepted_at ? (
              <p className="mt-5 text-sm text-muted-foreground">
                This invitation has already been accepted.
              </p>
            ) : invitation.is_expired ? (
              <p className="mt-5 text-sm text-destructive">
                This invitation has expired. Ask a workspace admin to send a new one.
              </p>
            ) : user ? (
              user.email.toLowerCase() === invitation.email.toLowerCase() ? (
                <Button
                  className="mt-6 w-full"
                  disabled={accepting}
                  onClick={() => void accept()}
                >
                  {accepting ? "Joining workspace…" : "Accept invitation"}
                </Button>
              ) : (
                <div className="mt-6 space-y-3">
                  <p className="text-sm text-destructive">
                    You are signed in as {user.email}. Sign in with {invitation.email} to
                    accept this invitation.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      logout();
                      router.replace(inviteUrl);
                    }}
                  >
                    Sign out and continue
                  </Button>
                </div>
              )
            ) : (
              <div className="mt-6 flex flex-col gap-3">
                <Button nativeButton={false} render={<Link href={registerUrl} />}>
                  Create account and accept
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={inviteUrl} />}
                >
                  Sign in and accept
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
