import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useStore } from "./store";
import { connectorInbox } from "@/lib/connector-checks.functions";
export function ConnectorNotifications() {
  const { current } = useStore();
  const q = useQuery({
    queryKey: ["connector-inbox", current.id],
    queryFn: () => connectorInbox({ data: current.id }),
    refetchInterval: 60000,
  });
  return (
    <section className="mx-auto max-w-5xl space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl">Notifications</h1>
      {q.isPending ? (
        <p>Checking for new items…</p>
      ) : q.isError ? (
        <p>Could not load notifications.</p>
      ) : q.data?.length ? (
        q.data.map((p) => (
          <Link
            key={p.id}
            className="block rounded-2xl border bg-card p-4"
            to="/app/$section/$id"
            params={{ section: "integrations", id: p.id }}
          >
            MatrixKeep found {p.count} {p.count === 1 ? "item" : "items"} in {p.name} ready for
            review. <span className="text-primary">Review items</span>
          </Link>
        ))
      ) : (
        <p>No connector items are waiting for review.</p>
      )}
    </section>
  );
}
