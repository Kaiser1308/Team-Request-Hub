"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsPending(true);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    setIsPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "register") {
      setMessage("Registration received. A lead must approve your account before you can enter.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-1">
        <button
          type="button"
          className={
            mode === "login"
              ? "rounded-md bg-white px-3 py-2 text-sm font-medium"
              : "px-3 py-2 text-sm"
          }
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          className={
            mode === "register"
              ? "rounded-md bg-white px-3 py-2 text-sm font-medium"
              : "px-3 py-2 text-sm"
          }
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="h-10 rounded-md border border-[#e5e7eb] px-3 text-sm font-normal"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            className="h-10 rounded-md border border-[#e5e7eb] px-3 text-sm font-normal"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Working..." : mode === "login" ? "Login" : "Register"}
        </Button>
      </form>
    </div>
  );
}
