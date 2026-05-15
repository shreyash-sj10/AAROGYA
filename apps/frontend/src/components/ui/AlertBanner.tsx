type AlertBannerTone = "error" | "warn" | "info";

const toneClass: Record<AlertBannerTone, string> = {
  error: "border-red-200 bg-red-50 text-red-900",
  warn: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-slate-50 text-slate-800",
};

import type { ReactNode } from "react";

type AlertBannerProps = {
  tone?: AlertBannerTone;
  children: ReactNode;
};

export function AlertBanner({ tone = "info", children }: AlertBannerProps) {
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      {children}
    </div>
  );
}
