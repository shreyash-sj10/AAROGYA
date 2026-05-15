import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { loginAndRoute } from "@/services/auth/session";
import { AuthScaffold } from "@/app/components/AuthScaffold";

function toUiError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Login failed";

  if (message.includes("401") || message.toLowerCase().includes("invalid credentials")) {
    return "Invalid email or password";
  }

  if (message.includes("500")) {
    return "Something went wrong. Please try again.";
  }

  return message;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const disableSubmit = useMemo(() => submitting || !email.trim() || password.length === 0, [submitting, email, password]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await loginAndRoute(email.trim(), password, navigate);
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScaffold
      mode="login"
      title="Welcome Back"
      subtitle="Sign in to continue your personalized Ayurvedic nutrition journey."
      error={error}
      footerText="Don't have an account?"
      footerLinkLabel="Create one"
      footerLinkTo="/app/signup"
    >
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.05 }} className="block">
          <span className="mb-1 block text-sm font-medium text-[#4d5446]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-[#d9cfbb] bg-white px-3 py-2.5 text-sm text-[#2f342a] shadow-sm transition-all duration-200 focus:border-[#6a8453] focus:outline-none focus:ring-4 focus:ring-[#cfdec2]"
          />
        </motion.label>

        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.12 }} className="block">
          <span className="mb-1 block text-sm font-medium text-[#4d5446]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-[#d9cfbb] bg-white px-3 py-2.5 text-sm text-[#2f342a] shadow-sm transition-all duration-200 focus:border-[#6a8453] focus:outline-none focus:ring-4 focus:ring-[#cfdec2]"
          />
        </motion.label>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.19 }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={disableSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6a8453] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#587141] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
          <span>{submitting ? "Signing in..." : "Login"}</span>
        </motion.button>
      </form>
    </AuthScaffold>
  );
}
