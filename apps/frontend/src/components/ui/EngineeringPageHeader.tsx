import type { ReactNode } from "react";

type EngineeringPageHeaderProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function EngineeringPageHeader({ title, description, meta, actions }: EngineeringPageHeaderProps) {
  return (
    <header className="plan-header flex flex-col gap-4 !rounded-2xl border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--plan-text)] sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-[color:var(--plan-muted)]">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
