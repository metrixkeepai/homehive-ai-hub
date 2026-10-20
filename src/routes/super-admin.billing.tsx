import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { billingTabs } from "@/components/hv/BillingKit";

export const Route = createFileRoute("/super-admin/billing")({ component: BillingLayout });

function BillingLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Billing sections">
        {billingTabs.map(([k, l]) =>
          k === "overview" ? (
            <Link
              key={k}
              to="/super-admin/billing"
              activeOptions={{ exact: true }}
              className="rounded-md border bg-card px-3 py-1.5 text-sm"
              activeProps={{ className: "bg-foreground text-background" }}
            >
              {l}
            </Link>
          ) : (
            <Link
              key={k}
              to="/super-admin/billing/$kind"
              params={{ kind: k }}
              className="rounded-md border bg-card px-3 py-1.5 text-sm"
              activeProps={{ className: "bg-foreground text-background" }}
            >
              {l}
            </Link>
          ),
        )}
      </nav>
      <Outlet />
    </div>
  );
}
