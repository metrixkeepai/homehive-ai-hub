import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAudit } from "@/lib/admin.functions";

export const Route = createFileRoute("/super-admin/audit")({ component: Audit });

const uuid = /^[0-9a-f-]{36}$/;

function Audit() {
  const fn = useServerFn(listAudit);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "audit"], queryFn: () => fn() });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-foreground">Audit log</h1>
      <p className="text-sm text-muted-foreground">
        Every change made from the Control Centre. Entries can't be edited or removed.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Admin</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("en-GB")}
                  </td>
                  <td className="p-3">{r.admin_email}</td>
                  <td className="p-3 capitalize">{r.action.replace(/_/g, " ")}</td>
                  <td className="p-3">
                    {r.target && uuid.test(r.target) ? (
                      <Link
                        to="/super-admin/subscribers/$id"
                        params={{ id: r.target }}
                        className="text-primary"
                      >
                        Open account
                      </Link>
                    ) : (
                      r.target
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{r.reason ?? "—"}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No admin actions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
