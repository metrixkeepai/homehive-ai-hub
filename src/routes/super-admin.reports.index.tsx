import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle } from "@/components/hv/AdminKpi";
import { reports } from "@/lib/reports";

export const Route = createFileRoute("/super-admin/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — MatrixKeep Control Centre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsHome,
});

function ReportsHome() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Reports"
        sub="Pick a report, choose dates, then download it for Excel or print it as PDF."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.key}
            to="/super-admin/reports/$key"
            params={{ key: r.key }}
            className="rounded-xl border bg-card p-4 transition hover:border-primary"
          >
            <p className="font-medium text-foreground">{r.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
            {r.needs && (
              <p className="mt-2 text-xs font-medium text-primary">
                Setup required: {r.needs.join(", ")}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
