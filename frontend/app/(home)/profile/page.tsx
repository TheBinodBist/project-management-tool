"use client";

import { Mail } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/lib/app-context";

export default function ProfilePage() {
  const { user } = useApp();
  const initials =
    user?.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() ?? "";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold">Your profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View the personal information associated with your account.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name ?? "Profile"} />
            <AvatarFallback className="text-lg">{initials || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{user?.full_name || "Your account"}</CardTitle>
            <CardDescription>Project Workspace account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 border-t pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Full name
            </p>
            <p className="mt-1 font-medium">{user?.full_name || "Not provided"}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Mail className="size-3.5" />
              Email address
            </p>
            <p className="mt-1 font-medium">{user?.email || "Not provided"}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
