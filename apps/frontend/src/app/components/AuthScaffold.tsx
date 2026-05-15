import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

type AuthScaffoldProps = {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  error: string | null;
  footerText: string;
  footerLinkLabel: string;
  footerLinkTo: string;
  children: ReactNode;
};

export function AuthScaffold(props: AuthScaffoldProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={props.mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="min-h-screen bg-[radial-gradient(circle_at_top,#f4eddc_0%,#eef3ea_45%,#f6f2ea_100%)] px-4 py-6 sm:px-6 sm:py-10"
      >
        <div className="mx-auto grid min-h-[84vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[#dfd5c2] bg-[#f8f3e8] shadow-[0_24px_60px_-28px_rgba(72,52,22,0.35)] lg:grid-cols-2">
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
            className="relative hidden overflow-hidden border-r border-[#ddd2bb] bg-[linear-gradient(145deg,#ede4d3_0%,#e1e9db_55%,#dce6d8_100%)] p-10 lg:block"
          >
            <img
              src="/auth-side-illustration.svg"
              alt="Ayurvedic herbs and botanicals"
              className="absolute inset-0 h-full w-full object-cover opacity-[0.38]"
              loading="eager"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(248,242,227,0.74)_0%,rgba(226,234,219,0.58)_52%,rgba(213,223,208,0.72)_100%)]" />
            <div className="pointer-events-none absolute -right-12 -top-10 h-52 w-52 rounded-full bg-[#8fa98e]/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-8 h-52 w-52 rounded-full bg-[#bfa780]/20 blur-2xl" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18))]" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5d694f]">Aarogya</p>
                <h1 className="mt-4 text-4xl leading-tight text-[#2f342a]" style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}>
                  Ayurveda For
                  <br />
                  Modern Rhythm
                </h1>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#46503d]">
                  A calm, guided nutrition experience grounded in classical Ayurvedic principles.
                </p>
              </div>

              <div className="relative rounded-2xl border border-[#c9bea6] bg-white/55 p-5 backdrop-blur-sm">
                <p className="text-lg leading-relaxed text-[#3c4533]" style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}>
                  &#x0938;&#x094D;&#x0935;&#x0938;&#x094D;&#x0925;&#x0938;&#x094D;&#x092F; &#x0938;&#x094D;&#x0935;&#x093E;&#x0938;&#x094D;&#x0925;&#x094D;&#x092F; &#x0930;&#x0915;&#x094D;&#x0937;&#x0923;&#x092E;&#x094D;, &#x0906;&#x0924;&#x0941;&#x0930;&#x0938;&#x094D;&#x092F; &#x0935;&#x093F;&#x0915;&#x093E;&#x0930; &#x092A;&#x094D;&#x0930;&#x0936;&#x092E;&#x0928;&#x092E;&#x094D;
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#5e6950]">
                  To preserve health and heal the unwell
                </p>
                <div className="pointer-events-none absolute bottom-4 right-4 h-8 w-8 rounded-full border border-[#92a285]/40 bg-[#b8c5ab]/30" />
              </div>
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center justify-center bg-[#f8f3e8] p-6 sm:p-10"
          >
            <div className="w-full max-w-md rounded-2xl border border-[#e1d8c6] bg-white/90 p-6 shadow-[0_14px_36px_-20px_rgba(68,48,20,0.35)] backdrop-blur-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7a5a]">Aarogya</p>
              <h2 className="mt-2 text-3xl text-[#2d312a]" style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}>{props.title}</h2>
              <p className="mt-2 text-sm text-[#626858]">{props.subtitle}</p>

              {props.children}

              {props.error ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {props.error}
                </p>
              ) : null}

              <p className="mt-5 text-center text-sm text-[#626858]">
                {props.footerText}{" "}
                <Link to={props.footerLinkTo} className="font-semibold text-[#5e7546] transition-colors hover:text-[#475b33]">
                  {props.footerLinkLabel}
                </Link>
              </p>
            </div>
          </motion.section>
        </div>
      </motion.main>
    </AnimatePresence>
  );
}
