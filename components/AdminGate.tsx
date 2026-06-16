"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";

type Step = "set-password" | "password" | "code";

type AdminGateProps = {
  hasPassword: boolean;
  emailMasked: string;
  emailConfigured: boolean;
};

export function AdminGate({ hasPassword, emailMasked, emailConfigured }: AdminGateProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(hasPassword ? "password" : "set-password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, body?: unknown) {
    const response = await fetch(`/api/admin/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const data = (await response.json()) as { error?: string; delivered?: string; step?: Step };

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  function announceDelivery(delivered?: string) {
    if (delivered === "console") {
      setInfo("SMTP isn't configured — your code was printed to the server console (dev mode).");
    } else {
      setInfo(`We sent a 6-digit code to ${emailMasked}. It expires in 10 minutes.`);
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const data = await post("set-password", { password, confirm });
      announceDelivery(data.delivered);
      setPassword("");
      setConfirm("");
      setStep("code");
    } catch (gateError) {
      setError(gateError instanceof Error ? gateError.message : "Could not set password.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await post("password", { password });
      announceDelivery(data.delivered);
      setPassword("");
      setStep("code");
    } catch (gateError) {
      setError(gateError instanceof Error ? gateError.message : "Could not verify password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await post("verify", { code });
      router.refresh();
    } catch (gateError) {
      setError(gateError instanceof Error ? gateError.message : "Could not verify code.");
      setBusy(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const data = await post("resend");
      announceDelivery(data.delivered);
    } catch (gateError) {
      setError(gateError instanceof Error ? gateError.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-gate-page">
      <div className="admin-gate-orb admin-gate-orb-one" aria-hidden="true" />
      <div className="admin-gate-orb admin-gate-orb-two" aria-hidden="true" />

      <motion.section
        className="admin-gate-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="admin-gate-badge">
          <ShieldCheck size={26} />
        </div>
        <p className="eyebrow">Restricted</p>
        <h1>Admin verification</h1>

        {step === "set-password" ? (
          <>
            <p className="admin-gate-sub">
              Create an admin-panel password for <strong>{emailMasked}</strong>. You&apos;ll then confirm a code sent
              to your email.
            </p>
            <form className="admin-gate-form" onSubmit={handleSetPassword}>
              <label className="admin-gate-field">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="New password (min 8 chars)"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                {renderEyeToggle()}
              </label>
              <label className="admin-gate-field">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  minLength={8}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
                {renderEyeToggle()}
              </label>
              {renderMessages()}
              <button className="admin-gate-submit" type="submit" disabled={busy}>
                {busy ? "Setting up..." : "Set password & send code"}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        ) : null}

        {step === "password" ? (
          <>
            <p className="admin-gate-sub">
              Enter your admin password. We&apos;ll send a verification code to <strong>{emailMasked}</strong>.
            </p>
            <form className="admin-gate-form" onSubmit={handlePassword}>
              <label className="admin-gate-field">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Admin password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
                {renderEyeToggle()}
              </label>
              {renderMessages()}
              <button className="admin-gate-submit" type="submit" disabled={busy}>
                {busy ? "Checking..." : "Submit & send code"}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <p className="admin-gate-sub">
              <MailCheck size={16} /> Enter the 6-digit code sent to <strong>{emailMasked}</strong>.
            </p>
            <form className="admin-gate-form" onSubmit={handleVerify}>
              <label className="admin-gate-field admin-gate-code">
                <KeyRound size={17} />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                />
              </label>
              {renderMessages()}
              <button className="admin-gate-submit" type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Verifying..." : "Verify & unlock"}
                <ArrowRight size={17} />
              </button>
            </form>
            <button className="admin-gate-link" type="button" onClick={() => void handleResend()} disabled={busy}>
              Resend code
            </button>
          </>
        ) : null}

        {!emailConfigured ? (
          <p className="admin-gate-note">SMTP is not configured yet — codes log to the server console in dev.</p>
        ) : null}
      </motion.section>
    </main>
  );

  function renderEyeToggle() {
    return (
      <button
        type="button"
        className="admin-gate-eye"
        onClick={() => setShowPassword((value) => !value)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    );
  }

  function renderMessages() {
    return (
      <>
        {error ? <p className="admin-gate-error">{error}</p> : null}
        {info && !error ? <p className="admin-gate-info">{info}</p> : null}
      </>
    );
  }
}
