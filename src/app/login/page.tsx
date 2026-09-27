"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "تعذر تسجيل الدخول");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div className="text-center">
          <div className="text-4xl" aria-hidden>
            ❤️‍🩹
          </div>
          <h1 className="mt-2 text-2xl font-extrabold">Health Tracker</h1>
          <p className="mt-1 text-sm muted">تسجيل دخول مقدم الرعاية</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="البريد الإلكتروني">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="كلمة المرور">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? "جارٍ الدخول…" : "دخول"}
          </Button>
        </form>
        <p className="text-center text-xs muted">
          حساب واحد فقط للعائلة — تذكيرات دقيقة ومراقبة الالتزام بالأدوية
        </p>
      </Card>
    </div>
  );
}
