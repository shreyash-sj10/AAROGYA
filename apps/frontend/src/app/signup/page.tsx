import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { signupAndRoute } from "@/services/auth/session";
import { AuthScaffold } from "@/app/components/AuthScaffold";

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const disableSubmit = useMemo(() => {
    return submitting || !name.trim() || !email.trim() || password.length < 6 || confirmPassword.length < 6;
  }, [submitting, name, email, password, confirmPassword]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      await signupAndRoute(email.trim(), password, navigate, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScaffold
      mode="signup"
      title="Create Account"
      subtitle="Begin your calm, guided Ayurvedic nutrition experience."
      error={error}
      footerText="Already have an account?"
      footerLinkLabel="Login"
      footerLinkTo="/app/login"
    >
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.05 }} className="block">
          <span className="mb-1 block text-sm font-medium text-[#4d5446]">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-xl border border-[#d9cfbb] bg-white px-3 py-2.5 text-sm text-[#2f342a] shadow-sm transition-all duration-200 focus:border-[#6a8453] focus:outline-none focus:ring-4 focus:ring-[#cfdec2]"
          />
        </motion.label>

        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.12 }} className="block">
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

        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.19 }} className="block">
          <span className="mb-1 block text-sm font-medium text-[#4d5446]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#d9cfbb] bg-white px-3 py-2.5 text-sm text-[#2f342a] shadow-sm transition-all duration-200 focus:border-[#6a8453] focus:outline-none focus:ring-4 focus:ring-[#cfdec2]"
          />
        </motion.label>

        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.26 }} className="block">
          <span className="mb-1 block text-sm font-medium text-[#4d5446]">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#d9cfbb] bg-white px-3 py-2.5 text-sm text-[#2f342a] shadow-sm transition-all duration-200 focus:border-[#6a8453] focus:outline-none focus:ring-4 focus:ring-[#cfdec2]"
          />
        </motion.label>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.33 }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={disableSubmit}
          className="w-full rounded-xl bg-[#6a8453] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#587141] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </motion.button>
      </form>
    </AuthScaffold>
  );
}

