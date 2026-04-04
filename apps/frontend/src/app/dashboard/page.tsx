import { usePlanStore } from "@/store/plan.store";

export default function DashboardPage() {
  const plan = usePlanStore((s) => s.plan);

  return (
    <main>
      <h2>Dashboard</h2>
      <p>Plan snapshot</p>
      <pre>{JSON.stringify(plan, null, 2)}</pre>
    </main>
  );
}
