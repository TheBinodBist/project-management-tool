"use client";

import * as React from "react";
import { apiRequest } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { user, updateProfile } = useApp();
  const [fullName, setFullName] = React.useState(user?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(user?.avatar_url ?? "");
  const [profileError, setProfileError] = React.useState("");
  const [profileSuccess, setProfileSuccess] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName.trim(), avatar_url: avatarUrl.trim() });
      setFullName(fullName.trim());
      setAvatarUrl(avatarUrl.trim());
      setProfileSuccess("Your profile settings have been saved.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest<void>("/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          old_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Your password has been changed.");
    } catch (reason) {
      setPasswordError(reason instanceof Error ? reason.message : "Could not change your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile information and account security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update the name and avatar shown to your workspace teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Full name</Label>
              <Input
                id="settings-name"
                autoComplete="name"
                maxLength={150}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email address</Label>
              <Input id="settings-email" type="email" value={user?.email ?? ""} readOnly />
              <p className="text-xs text-muted-foreground">
                Email addresses cannot be changed here.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-avatar">Avatar URL</Label>
              <Input
                id="settings-avatar"
                type="url"
                placeholder="https://example.com/avatar.png"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
              />
            </div>
            {profileError && <p role="alert" className="text-sm text-destructive">{profileError}</p>}
            {profileSuccess && <p role="status" className="text-sm text-emerald-600">{profileSuccess}</p>}
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Use your current password to set a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={changePassword}>
            <div className="space-y-2">
              <Label htmlFor="settings-current-password">Current password</Label>
              <Input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">New password</Label>
              <Input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">Confirm new password</Label>
              <Input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p role="status" className="text-sm text-emerald-600">{passwordSuccess}</p>}
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
