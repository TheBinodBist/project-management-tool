"use client";

import * as React from "react";
import Link from "next/link";

import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useApp();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) await register(email, name, password);
      else await login(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">Project Workspace</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRegister
              ? "Sign up to start organizing your team's work."
              : "Sign in to continue to your workspace."}
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="block space-y-2 text-sm font-medium">
              Full name
              <Input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
          )}
          <label className="block space-y-2 text-sm font-medium">
            Email
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Password
            <Input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button className="h-10 w-full" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : isRegister
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account?" : "New to Project Workspace?"}{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={isRegister ? "/login" : "/register"}
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
