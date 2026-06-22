"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ThemeToggleButton } from "@/components/ThemeToggle";

type AuthFormProps = {
  mode: "login" | "signup";
};

type SignupStep = "form" | "verify" | "success";

const ACCOUNT_CREATION_DISABLED = false;
const ACCOUNT_CREATION_DISABLED_MESSAGE = "New account creation is temporarily disabled.";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_unconfigured: "Google sign-in isn't configured yet. Please use email for now.",
  google_failed: "Google sign-in failed. Please try again.",
  google_state: "Google sign-in expired or was interrupted. Please try again.",
  google_unverified: "Your Google email isn't verified. Verify it with Google, or sign in with email and password.",
  inactive: "This account is inactive. Contact the administrator."
};

/** Official multi-colour Google "G" mark. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } }
};

const SHOWCASE_SLIDES = [
  "Think bigger,\ncreate faster.",
  "Your ideas,\nsupercharged by AI.",
  "One workspace,\nevery model."
];

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // Two-step signup state
  const [step, setStep] = useState<SignupStep>("form");
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [delivery, setDelivery] = useState<"email" | "console" | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const isSignup = mode === "signup";
  const isSignupDisabled = isSignup && ACCOUNT_CREATION_DISABLED;
  const isCreateAccountLinkDisabled = !isSignup && ACCOUNT_CREATION_DISABLED;
  const passwordScore = getPasswordScore(password);
  const redirectPath = getSafeRedirectPath(searchParams.get("redirect"));
  const switchHref = buildAuthModeHref(isSignup ? "/login" : "/signup", redirectPath);

  // Surface OAuth errors handed back via ?error= from the Google callback.
  useEffect(() => {
    const code = searchParams.get("error");

    if (code) {
      setError(GOOGLE_ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.");
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (isSignupDisabled) {
      setError(ACCOUNT_CREATION_DISABLED_MESSAGE);
      return;
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!agreeTerms) {
        setError("Please accept the Terms & Conditions to continue.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        // Step 1 — request a verification code (no account created yet).
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });
        const data = (await response.json()) as { error?: string; email?: string; delivered?: "email" | "console" };

        if (!response.ok) {
          throw new Error(data.error || "Could not start signup.");
        }

        setPendingEmail(data.email || email.trim().toLowerCase());
        setDelivery(data.delivered ?? null);
        setCode("");
        setStep("verify");
      } else {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed.");
        }

        router.push(redirectPath);
        router.refresh();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      // Step 3 — account created; show success, then enter the workspace.
      setStep("success");
      window.setTimeout(() => {
        router.push(redirectPath);
        router.refresh();
      }, 1900);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending) {
      return;
    }

    setError("");
    setInfo("");
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail })
      });
      const data = (await response.json()) as { error?: string; delivered?: "email" | "console" };

      if (!response.ok) {
        throw new Error(data.error || "Could not resend the code.");
      }

      setDelivery(data.delivered ?? null);
      setInfo("A new code is on its way.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend the code.");
    } finally {
      setIsResending(false);
    }
  }

  function handleBackToForm() {
    setStep("form");
    setCode("");
    setError("");
    setInfo("");
  }

  function handleSocialSignIn(_provider: "Google") {
    // Hand off to the server OAuth flow (sets CSRF state + redirects to Google).
    window.location.href = "/api/auth/google";
  }

  function handleForgotPassword() {
    setError("");
    setInfo("");
    setShowForgot(true);
  }

  function triggerModeSwitch() {
    if (isCreateAccountLinkDisabled) {
      setError(ACCOUNT_CREATION_DISABLED_MESSAGE);
      return;
    }

    if (isSwitchingMode) {
      return;
    }

    setError("");
    setInfo("");
    setIsSwitchingMode(true);

    window.setTimeout(() => {
      router.push(switchHref);
    }, 340);
  }

  function handleModeSwitch(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    triggerModeSwitch();
  }

  const title = isSignup ? "Create an account" : "Sign in to your account";
  const subtitle = isSignup
    ? isSignupDisabled
      ? ACCOUNT_CREATION_DISABLED_MESSAGE
      : "Start your journey with Aria Mind."
    : "Welcome back — sign in to continue.";

  const panelKey = isSignup ? `signup-${step}` : showForgot ? "forgot" : "login";

  return (
    <main className="auth-page">
      {/* Pure-CSS night sky — black with twinkling stars (no image) */}
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-stars auth-stars-far" />
        <div className="auth-stars auth-stars-mid" />
        <div className="auth-stars auth-stars-near" />
        <div className="auth-nebula" />
        <span className="auth-shooting auth-shooting-one" />
        <span className="auth-shooting auth-shooting-two" />
      </div>

      <ThemeToggleButton className="auth-theme-toggle" />

      <motion.section
        className={`auth-shell ${isSignup ? "is-signup" : "is-login"}${isSwitchingMode ? " is-switching" : ""}`}
        aria-label={isSignup ? "Create account" : "Sign in"}
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        {/* Desktop visual panel — slides to the opposite side when modes swap */}
        <motion.aside
          className="auth-showcase"
          initial={{ opacity: 0, x: isSignup ? -70 : 70 }}
          animate={isSwitchingMode ? { opacity: 0, x: isSignup ? 90 : -90 } : { opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <div className="auth-showcase-glow" aria-hidden="true" />

          <div className="auth-showcase-top">
            <div className="auth-showcase-brand">
              <img
                className="auth-brand-logo"
                src="/Aria%20logo/logo.jpeg"
                alt="Aria Mind logo"
                width={40}
                height={40}
                draggable={false}
              />
              <span>
              <strong>AriamindX</strong>
              <small>By JB Crownstone</small>
              </span>
            </div>
            <Link className="auth-back-pill" href="/">
              Back to website <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>

          <div className="auth-core" aria-hidden="true">
            <span className="auth-core-pulse" />
            <span className="auth-core-glow" />
            <span className="auth-orbit auth-orbit-one">
              <span className="auth-orbit-dot" />
            </span>
            <span className="auth-orbit auth-orbit-two">
              <span className="auth-orbit-dot" />
            </span>
            <span className="auth-orbit auth-orbit-three">
              <span className="auth-orbit-dot" />
            </span>
          </div>

          <div className="auth-showcase-bottom">
            <AnimatePresence mode="wait">
              <motion.h2
                key={mode}
                className="auth-showcase-headline"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                {(isSignup ? SHOWCASE_SLIDES[0] : SHOWCASE_SLIDES[1]).split("\n").map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </motion.h2>
            </AnimatePresence>
            <div className="auth-dots" aria-hidden="true">
              <span />
              <span />
              <span className="is-active" />
            </div>

            <div className="auth-showcase-cta">
              <span>{isSignup ? "Already have an account?" : "New to Aria Mind?"}</span>
              <button
                className="auth-showcase-btn"
                type="button"
                onClick={triggerModeSwitch}
                disabled={isSwitchingMode}
              >
                {isSignup ? "Login" : "Register"}
              </button>
            </div>
          </div>
        </motion.aside>

        {/* Form panel — slides to the opposite side when modes swap */}
        <motion.div
          className="auth-panel"
          initial={{ opacity: 0, x: isSignup ? 70 : -70 }}
          animate={isSwitchingMode ? { opacity: 0, x: isSignup ? -90 : 90 } : { opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          {/* Mobile-only back button */}
          <Link className="auth-back-button" href="/" aria-label="Go back">
            <ChevronLeft aria-hidden="true" size={22} />
          </Link>

          <AnimatePresence mode="wait">
            <motion.div
              key={panelKey}
              className="auth-panel-inner"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {isSignup && step === "verify" ? (
                <VerifyStep
                  pendingEmail={pendingEmail}
                  code={code}
                  setCode={setCode}
                  onVerify={handleVerify}
                  onResend={handleResend}
                  onBack={handleBackToForm}
                  isSubmitting={isSubmitting}
                  isResending={isResending}
                  delivery={delivery}
                  error={error}
                  info={info}
                />
              ) : isSignup && step === "success" ? (
                <SuccessStep onContinue={() => router.push(redirectPath)} />
              ) : !isSignup && showForgot ? (
                <ForgotPasswordFlow
                  initialEmail={email}
                  onBack={() => {
                    setShowForgot(false);
                    setError("");
                    setInfo("");
                  }}
                />
              ) : (
                <>
                  <motion.header className="auth-heading" variants={itemVariants}>
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                  </motion.header>

                  <form className="auth-form" onSubmit={handleSubmit}>
                    {isSignup ? (
                      <motion.label className="auth-field" variants={itemVariants}>
                        <span className="auth-field-label">Full Name</span>
                        <span className="auth-field-control">
                          <input
                            autoComplete="name"
                            placeholder="Anoop Kumar"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                          />
                        </span>
                      </motion.label>
                    ) : null}

                    <motion.label className="auth-field" variants={itemVariants}>
                      <span className="auth-field-label">Email</span>
                      <span className="auth-field-control">
                        <input
                          autoComplete="email"
                          placeholder="you@example.com"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                      </span>
                    </motion.label>

                    <motion.label className="auth-field" variants={itemVariants}>
                      <span className="auth-field-label">Password</span>
                      <span className="auth-field-control">
                        <input
                          autoComplete={isSignup ? "new-password" : "current-password"}
                          minLength={8}
                          placeholder="••••••••"
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
                          {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                        </button>
                      </span>
                    </motion.label>

                    {isSignup ? (
                      <motion.label className="auth-field" variants={itemVariants}>
                        <span className="auth-field-label">Repeat Password</span>
                        <span className="auth-field-control">
                          <input
                            autoComplete="new-password"
                            minLength={8}
                            placeholder="••••••••"
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            required
                          />
                          <button
                            className="auth-password-toggle"
                            type="button"
                            onClick={() => setShowConfirm((value) => !value)}
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                            title={showConfirm ? "Hide password" : "Show password"}
                          >
                            {showConfirm ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                          </button>
                        </span>
                      </motion.label>
                    ) : null}

                    {isSignup ? (
                      <motion.div className="auth-strength" aria-hidden="true" variants={itemVariants}>
                        {[0, 1, 2, 3].map((index) => (
                          <span className={index < passwordScore ? "is-active" : ""} key={index} />
                        ))}
                      </motion.div>
                    ) : null}

                    {isSignup ? (
                      <motion.label className="auth-terms" variants={itemVariants}>
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(event) => setAgreeTerms(event.target.checked)}
                        />
                        <span className="auth-checkbox" aria-hidden="true" />
                        <span>
                          I agree to the{" "}
                          <a
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Terms &amp; Conditions
                          </a>
                        </span>
                      </motion.label>
                    ) : (
                      <motion.div className="auth-forgot-row" variants={itemVariants}>
                        <button className="auth-forgot" type="button" onClick={handleForgotPassword}>
                          Forgot Password
                        </button>
                      </motion.div>
                    )}

                    <AnimatePresence>
                      {error ? (
                        <motion.p
                          className="auth-error"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          {error}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>

                    <motion.button
                      className="auth-submit"
                      type="submit"
                      disabled={isSubmitting || isSignupDisabled}
                      variants={itemVariants}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                    >
                      {isSignupDisabled
                        ? "Account creation disabled"
                        : isSubmitting
                          ? "Please wait..."
                          : isSignup
                            ? "Register"
                            : "Login"}
                    </motion.button>
                  </form>

                  <motion.div className="auth-divider" variants={itemVariants}>
                    <span>{isSignup ? "Or register with" : "Or login with"}</span>
                  </motion.div>

                  <motion.div className="auth-social-row is-single" variants={itemVariants}>
                    <button className="auth-social-button" type="button" onClick={() => handleSocialSignIn("Google")}>
                      <GoogleLogo />
                      <span>Continue with Google</span>
                    </button>
                  </motion.div>

                  <motion.p className="auth-switch auth-mode-switch" variants={itemVariants}>
                    {isSignup ? "I have an account?" : "Don't have an account?"}{" "}
                    {isCreateAccountLinkDisabled ? (
                      <span className="auth-switch-disabled" aria-disabled="true" title={ACCOUNT_CREATION_DISABLED_MESSAGE}>
                        Register
                      </span>
                    ) : (
                      <Link href={switchHref} onClick={handleModeSwitch} aria-disabled={isSwitchingMode}>
                        {isSignup ? "Log in" : "Register"}
                      </Link>
                    )}
                  </motion.p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.section>
    </main>
  );
}

type VerifyStepProps = {
  pendingEmail: string;
  code: string;
  setCode: (value: string) => void;
  onVerify: (event: FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  isResending: boolean;
  delivery: "email" | "console" | null;
  error: string;
  info: string;
};

function VerifyStep({
  pendingEmail,
  code,
  setCode,
  onVerify,
  onResend,
  onBack,
  isSubmitting,
  isResending,
  delivery,
  error,
  info
}: VerifyStepProps) {
  return (
    <>
      <motion.header className="auth-heading" variants={itemVariants}>
        <span className="auth-verify-icon" aria-hidden="true">
          <MailCheck size={26} />
        </span>
        <h1>Verify your email</h1>
        <p>
          Enter the 6-digit code we sent to <strong className="auth-verify-email">{pendingEmail}</strong>.
        </p>
      </motion.header>

      <form className="auth-form" onSubmit={onVerify}>
        <motion.label className="auth-field auth-code-field" variants={itemVariants}>
          <span className="auth-field-label">Verification code</span>
          <span className="auth-field-control">
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
            />
          </span>
        </motion.label>

        {delivery === "console" ? (
          <motion.p className="auth-info" variants={itemVariants}>
            Dev mode: SMTP isn&apos;t configured, so the code was printed to the server console.
          </motion.p>
        ) : null}

        <AnimatePresence>
          {error ? (
            <motion.p
              className="auth-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              {error}
            </motion.p>
          ) : info ? (
            <motion.p
              className="auth-info"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              {info}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.button
          className="auth-submit"
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          variants={itemVariants}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
        >
          {isSubmitting ? "Verifying..." : "Verify & create account"}
        </motion.button>
      </form>

      <motion.p className="auth-switch" variants={itemVariants}>
        Didn&apos;t get it?{" "}
        <button className="auth-text-link" type="button" onClick={onResend} disabled={isResending}>
          {isResending ? "Sending..." : "Resend code"}
        </button>
      </motion.p>

      <motion.button className="auth-back-link" type="button" onClick={onBack} variants={itemVariants}>
        <ArrowLeft aria-hidden="true" size={16} /> Use a different email
      </motion.button>
    </>
  );
}

function SuccessStep({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div
      className="auth-success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <motion.span
        className="auth-success-icon"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}
      >
        <CheckCircle2 size={48} strokeWidth={2.2} />
      </motion.span>
      <h1>You&apos;re successfully registered!</h1>
      <p>Your Aria Mind account is ready. Taking you to your workspace…</p>
      <button className="auth-submit" type="button" onClick={onContinue}>
        Continue
      </button>
    </motion.div>
  );
}

type ForgotStep = "email" | "code" | "reset" | "done";

function ForgotPasswordFlow({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [fStep, setFStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [delivery, setDelivery] = useState<"email" | "console" | null>(null);

  const score = getPasswordScore(password);

  async function sendCode(isResend: boolean) {
    const setLoading = isResend ? setResending : setBusy;
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as { error?: string; delivered?: "email" | "console" };

      if (!response.ok) {
        throw new Error(data.error || "Could not send the reset code.");
      }

      setDelivery(data.delivered ?? null);

      if (isResend) {
        setInfo("A new code is on its way.");
      } else {
        setCode("");
        setFStep("code");
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode(false);
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setFStep("reset");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not reset your password.");
      }

      setFStep("done");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={fStep} variants={containerVariants} initial="hidden" animate="show">
        {fStep === "email" ? (
          <>
            <motion.header className="auth-heading" variants={itemVariants}>
              <span className="auth-verify-icon" aria-hidden="true">
                <KeyRound size={26} />
              </span>
              <h1>Reset your password</h1>
              <p>Enter your registered email and we&apos;ll send you a reset code.</p>
            </motion.header>

            <form className="auth-form" onSubmit={handleEmailSubmit}>
              <motion.label className="auth-field" variants={itemVariants}>
                <span className="auth-field-label">Email</span>
                <span className="auth-field-control">
                  <input
                    autoComplete="email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoFocus
                  />
                </span>
              </motion.label>

              <ForgotMessage error={error} info={info} />

              <motion.button
                className="auth-submit"
                type="submit"
                disabled={busy}
                variants={itemVariants}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
              >
                {busy ? "Sending..." : "Send reset code"}
              </motion.button>
            </form>

            <motion.button className="auth-back-link" type="button" onClick={onBack} variants={itemVariants}>
              <ArrowLeft aria-hidden="true" size={16} /> Back to sign in
            </motion.button>
          </>
        ) : fStep === "code" ? (
          <>
            <motion.header className="auth-heading" variants={itemVariants}>
              <span className="auth-verify-icon" aria-hidden="true">
                <MailCheck size={26} />
              </span>
              <h1>Enter the code</h1>
              <p>
                We sent a 6-digit code to <strong className="auth-verify-email">{email}</strong>.
              </p>
            </motion.header>

            <form className="auth-form" onSubmit={handleCodeSubmit}>
              <motion.label className="auth-field auth-code-field" variants={itemVariants}>
                <span className="auth-field-label">Verification code</span>
                <span className="auth-field-control">
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="------"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                  />
                </span>
              </motion.label>

              {delivery === "console" ? (
                <motion.p className="auth-info" variants={itemVariants}>
                  Dev mode: SMTP isn&apos;t configured, so the code was printed to the server console.
                </motion.p>
              ) : null}

              <ForgotMessage error={error} info={info} />

              <motion.button
                className="auth-submit"
                type="submit"
                disabled={busy || code.length !== 6}
                variants={itemVariants}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
              >
                {busy ? "Verifying..." : "Verify code"}
              </motion.button>
            </form>

            <motion.p className="auth-switch" variants={itemVariants}>
              Didn&apos;t get it?{" "}
              <button className="auth-text-link" type="button" onClick={() => sendCode(true)} disabled={resending}>
                {resending ? "Sending..." : "Resend code"}
              </button>
            </motion.p>

            <motion.button
              className="auth-back-link"
              type="button"
              onClick={() => {
                setError("");
                setInfo("");
                setFStep("email");
              }}
              variants={itemVariants}
            >
              <ArrowLeft aria-hidden="true" size={16} /> Use a different email
            </motion.button>
          </>
        ) : fStep === "reset" ? (
          <>
            <motion.header className="auth-heading" variants={itemVariants}>
              <span className="auth-verify-icon" aria-hidden="true">
                <KeyRound size={26} />
              </span>
              <h1>Set a new password</h1>
              <p>Choose a new password for your account.</p>
            </motion.header>

            <form className="auth-form" onSubmit={handleResetSubmit}>
              <motion.label className="auth-field" variants={itemVariants}>
                <span className="auth-field-label">New password</span>
                <span className="auth-field-control">
                  <input
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="••••••••"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPw((value) => !value)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </span>
              </motion.label>

              <motion.label className="auth-field" variants={itemVariants}>
                <span className="auth-field-label">Repeat password</span>
                <span className="auth-field-control">
                  <input
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="••••••••"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowConfirmPw((value) => !value)}
                    aria-label={showConfirmPw ? "Hide password" : "Show password"}
                  >
                    {showConfirmPw ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </span>
              </motion.label>

              <motion.div className="auth-strength" aria-hidden="true" variants={itemVariants}>
                {[0, 1, 2, 3].map((index) => (
                  <span className={index < score ? "is-active" : ""} key={index} />
                ))}
              </motion.div>

              <ForgotMessage error={error} info={info} />

              <motion.button
                className="auth-submit"
                type="submit"
                disabled={busy}
                variants={itemVariants}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
              >
                {busy ? "Updating..." : "Update password"}
              </motion.button>
            </form>
          </>
        ) : (
          <motion.div
            className="auth-success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
          >
            <motion.span
              className="auth-success-icon"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}
            >
              <CheckCircle2 size={48} strokeWidth={2.2} />
            </motion.span>
            <h1>Password updated!</h1>
            <p>You can now sign in with your new password.</p>
            <button className="auth-submit" type="button" onClick={onBack}>
              Back to sign in
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function ForgotMessage({ error, info }: { error: string; info: string }) {
  return (
    <AnimatePresence>
      {error ? (
        <motion.p
          className="auth-error"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
        >
          {error}
        </motion.p>
      ) : info ? (
        <motion.p
          className="auth-info"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
        >
          {info}
        </motion.p>
      ) : null}
    </AnimatePresence>
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
