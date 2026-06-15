"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type MouseEvent } from "react";
import { ArrowRight, Chrome, Eye, EyeOff, Github, LockKeyhole, Mail, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { AionLogo } from "@/components/AionLogo";
import { NeuralBackdrop } from "@/components/NeuralBackdrop";

type AuthFormProps = {
  mode: "login" | "signup";
};

const ACCOUNT_CREATION_DISABLED = false;
const ACCOUNT_CREATION_DISABLED_MESSAGE = "New account creation is temporarily disabled.";

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const isSignup = mode === "signup";
  const isSignupDisabled = isSignup && ACCOUNT_CREATION_DISABLED;
  const isCreateAccountLinkDisabled = !isSignup && ACCOUNT_CREATION_DISABLED;
  const passwordScore = getPasswordScore(password);
  const redirectPath = getSafeRedirectPath(searchParams.get("redirect"));
  const switchHref = buildAuthModeHref(isSignup ? "/login" : "/signup", redirectPath);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isSignupDisabled) {
      setError(ACCOUNT_CREATION_DISABLED_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password
        })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      router.push(redirectPath);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSocialSignIn(provider: "Google" | "GitHub") {
    setError(`${provider} sign-in is not configured yet. Please use email for now.`);
  }

  function handleModeSwitch(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();

    if (isCreateAccountLinkDisabled) {
      setError(ACCOUNT_CREATION_DISABLED_MESSAGE);
      return;
    }

    if (isSwitchingMode) {
      return;
    }

    setError("");
    setIsSwitchingMode(true);

    window.setTimeout(() => {
      router.push(switchHref);
    }, 420);
  }

  const title = isSignup ? "Create your account" : "Welcome back";
  const subtitle = isSignup
    ? isSignupDisabled
      ? ACCOUNT_CREATION_DISABLED_MESSAGE
      : "Free to start - no card required."
    : "Sign in to continue your Aria Mind workspace.";
  const sideTransition = { duration: 0.42, ease: "easeInOut" as const };

  return (
    <main className="auth-page">
      <NeuralBackdrop intensity="active" />
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <motion.section
        className={`auth-device${isSwitchingMode ? " is-switching" : ""}`}
        aria-label={isSignup ? "Create account" : "Sign in"}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        <motion.div
          className="auth-showcase"
          aria-hidden="true"
          initial={{ opacity: 0, x: -64 }}
          animate={isSwitchingMode ? { opacity: 0.55, x: 86 } : { opacity: 1, x: 0 }}
          transition={sideTransition}
        >
          <div className="auth-mind-visual" />
          <div className="auth-showcase-brand">
            <AionLogo size={30} decorative />
            <div>
              <strong>Aria Mind</strong>
              <span>JB Crownstone </span>
            </div>
          </div>
          <div className="auth-orbit-line auth-orbit-one" />
          <div className="auth-orbit-line auth-orbit-two" />
          <div className="auth-showcase-copy">
            <p>{isSignup ? "START YOUR" : "WELCOME"}</p>
            <h2>{isSignup ? "ADVENTURE!" : "BACK!"}</h2>
          </div>
        </motion.div>

        <motion.div
          className="auth-panel"
          initial={{ opacity: 0, x: 64 }}
          animate={isSwitchingMode ? { opacity: 0.58, x: -86 } : { opacity: 1, x: 0 }}
          transition={sideTransition}
        >
          <motion.div
            className="auth-panel-inner auth-panel-card"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.42, delay: 0.08, ease: "easeOut" }}
          >
            <header className="auth-heading">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </header>

            <div className="auth-social-row">
              <button className="auth-social-button" type="button" onClick={() => handleSocialSignIn("Google")}>
                <Chrome aria-hidden="true" size={18} />
                <span>Google</span>
              </button>
              <button className="auth-social-button" type="button" onClick={() => handleSocialSignIn("GitHub")}>
                <Github aria-hidden="true" size={18} />
                <span>GitHub</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>or with email</span>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup ? (
                <label className="auth-label">
                  <span>Name</span>
                  <span className="auth-field">
                    <UserRound aria-hidden="true" size={18} />
                    <input
                      autoComplete="name"
                      placeholder="Anoop Kumar"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </span>
                </label>
              ) : null}
              <label className="auth-label">
                <span>Email</span>
                <span className="auth-field">
                  <Mail aria-hidden="true" size={18} />
                  <input
                    autoComplete="email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>
              <label className="auth-label">
                <span>Password</span>
                <span className="auth-field">
                  <LockKeyhole aria-hidden="true" size={18} />
                  <input
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    minLength={8}
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                  </button>
                </span>
              </label>
              {isSignup ? (
                <div className="auth-strength" aria-hidden="true">
                  {[0, 1, 2, 3].map((index) => (
                    <span className={index < passwordScore ? "is-active" : ""} key={index} />
                  ))}
                </div>
              ) : null}
              {error ? <p className="auth-error">{error}</p> : null}
              <button className="auth-submit" type="submit" disabled={isSubmitting || isSignupDisabled}>
                <span>
                  {isSignupDisabled
                    ? "Account creation disabled"
                    : isSubmitting
                      ? "Please wait..."
                      : isSignup
                        ? "Create account"
                        : "Sign in"}
                </span>
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>

            <p className="auth-switch">
              {isSignup ? "Already have an account?" : "Need an account?"}{" "}
              {isCreateAccountLinkDisabled ? (
                <span className="auth-switch-disabled" aria-disabled="true" title={ACCOUNT_CREATION_DISABLED_MESSAGE}>
                  Create account
                </span>
              ) : (
                <Link href={switchHref} onClick={handleModeSwitch} aria-disabled={isSwitchingMode}>
                  {isSignup ? "Sign in" : "Create account"}
                </Link>
              )}
            </p>
          </motion.div>
        </motion.div>
      </motion.section>
    </main>
  );
}

function buildAuthModeHref(path: "/login" | "/signup", redirectPath: string) {
  if (redirectPath === "/chat") {
    return path;
  }

  return `${path}?redirect=${encodeURIComponent(redirectPath)}`;
}

function getSafeRedirectPath(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/chat";
}

function getPasswordScore(password: string) {
  if (!password) {
    return 0;
  }

  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password) || password.length >= 12
  ];

  return Math.max(1, checks.filter(Boolean).length);
}
