import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useStore } from "@/components/hv/store";
import { eventsFrom, toIcs, type CalEvent } from "@/components/hv/calendar";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  head: () => ({
    meta: [
      { title: "Smart Calendar — MatrixKeep AI" },
      {
        name: "description",
        content:
          "Warranties, renewals, services and deadlines across your properties in one calendar.",
      },
      { property: "og:title", content: "Smart Calendar — MatrixKeep AI" },
      {
        property: "og:description",
        content:
          "Warranties, renewals, services and deadlines across your properties in one calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const TONE: Record<string, string> = {
  Warranty: "bg-success/15 text-success",
  Renewal: "bg-warning/20 text-warning",
  Insurance: "bg-primary/10 text-primary",
  Maintenance: "bg-accent text-accent-foreground",
  Task: "bg-secondary text-foreground",
  Vehicle: "bg-destructive/15 text-destructive",
};
const tone = (k: string) => TONE[k] ?? "bg-secondary text-muted-foreground";

function CalendarPage() {
  const { added, properties, current } = useStore();
  const biz = current.type !== "individual";
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "list">("month");
  const [prop, setProp] = useState("all");
  const [kind, setKind] = useState("All");
  const all = useMemo(() => eventsFrom(added), [added]);
  const kinds = ["All", ...new Set(all.map((e) => e.kind))];
  const events = all.filter(
    (e) =>
      (prop === "all" || (prop === "none" ? !e.propertyId : e.propertyId === prop)) &&
      (kind === "All" || e.kind === kind),
  );
  const today = new Date();
  const upcoming = events
    .filter((e) => differenceInCalendarDays(parseISO(e.date), today) >= 0)
    .slice(0, 8);
  const overdue = events.filter(
    (e) => differenceInCalendarDays(parseISO(e.date), today) < 0 && e.kind !== "Document",
  );
  const propName = (id: string | null) => properties.find((p) => p.id === id)?.title;
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const exportIcs = () => {
    const blob = new Blob([toIcs(events)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "matrixkeep-calendar.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const Chip = ({ e }: { e: CalEvent }) => (
    <Link
      to="/app/$section/$id"
      params={{ section: e.slug, id: e.itemId }}
      title={`${e.title} — ${e.label}`}
      className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone(e.kind)}`}
    >
      {e.title}
    </Link>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">Calendar</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl">
            <CalendarClock className="h-7 w-7 text-primary" />
            Calendar
          </h1>
          <p className="mt-2 text-muted-foreground">
            Every warranty, renewal, service and deadline across your{" "}
            {biz ? "locations" : "properties"}.
          </p>
        </div>
        <button
          onClick={exportIcs}
          disabled={!events.length}
          className="flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Add to my calendar (.ics)
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["Upcoming", events.length - overdue.length],
            [
              "Next 30 days",
              events.filter((e) => {
                const d = differenceInCalendarDays(parseISO(e.date), today);
                return d >= 0 && d <= 30;
              }).length,
            ],
            ["Overdue", overdue.length],
            [biz ? "Locations" : "Properties", properties.length],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="font-display text-2xl">{v}</p>
            <p className="text-sm text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Property"
          value={prop}
          onChange={(e) => setProp(e.target.value)}
          className="rounded-full border bg-card px-4 py-2 text-sm"
        >
          <option value="all">All {biz ? "locations" : "properties"}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </select>
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary"}`}
          >
            {k}
          </button>
        ))}
        <div className="ml-auto flex rounded-full border bg-card p-1 text-sm">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 capitalize ${view === v ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {!all.length ? (
        <div className="rounded-3xl border bg-card p-10 text-center shadow-soft">
          <p className="font-display text-2xl">Nothing on your calendar yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a warranty or renewal with a date, or upload a contract through Add anything, and
            its dates appear here.
          </p>
          <Link
            to="/app/$section"
            params={{ section: "warranties" }}
            search={{ add: 1 }}
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Add a warranty
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {view === "month" ? (
            <section className="rounded-3xl border bg-card p-4 shadow-soft md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <button
                  aria-label="Previous month"
                  onClick={() => setMonth((m) => addMonths(m, -1))}
                  className="rounded-full p-2 hover:bg-secondary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl">{format(month, "MMMM yyyy")}</h2>
                  <button
                    onClick={() => setMonth(startOfMonth(new Date()))}
                    className="rounded-full border px-3 py-1 text-xs"
                  >
                    Today
                  </button>
                </div>
                <button
                  aria-label="Next month"
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="rounded-full p-2 hover:bg-secondary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const key = format(d, "yyyy-MM-dd");
                  const es = events.filter((e) => e.date === key);
                  const isToday = key === format(today, "yyyy-MM-dd");
                  return (
                    <div
                      key={key}
                      className={`min-h-20 rounded-xl border p-1 ${isSameMonth(d, month) ? "" : "opacity-40"} ${isToday ? "border-primary" : ""}`}
                    >
                      <p
                        className={`text-right text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}
                      >
                        {format(d, "d")}
                      </p>
                      <div className="space-y-0.5">
                        {es.slice(0, 3).map((e) => (
                          <Chip key={e.key} e={e} />
                        ))}
                        {es.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">+{es.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="divide-y rounded-3xl border bg-card shadow-soft">
              {events.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nothing matches these filters.
                </p>
              )}
              {events.map((e) => {
                const n = differenceInCalendarDays(parseISO(e.date), today);
                return (
                  <Link
                    key={e.key}
                    to="/app/$section/$id"
                    params={{ section: e.slug, id: e.itemId }}
                    className="flex items-center gap-4 p-4 hover:bg-secondary/40"
                  >
                    <div className="w-14 text-center">
                      <p className="font-display text-xl">{format(parseISO(e.date), "d")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(e.date), "MMM yy")}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {e.label}
                        {propName(e.propertyId) ? ` · ${propName(e.propertyId)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone(e.kind)}`}
                    >
                      {e.kind}
                    </span>
                    <span
                      className={`hidden w-24 text-right text-xs sm:block ${n < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {n < 0 ? `${-n} days ago` : n === 0 ? "Today" : `in ${n} days`}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}
          <aside className="space-y-3 rounded-3xl border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg">Coming up</h2>
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing due soon.</p>
            )}
            {upcoming.map((e) => (
              <Link
                key={e.key}
                to="/app/$section/$id"
                params={{ section: e.slug, id: e.itemId }}
                className="block rounded-xl border p-3 hover:border-primary"
              >
                <p className="truncate text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.label} · {format(parseISO(e.date), "d MMM yyyy")}
                </p>
                {propName(e.propertyId) && (
                  <p className="text-xs text-primary">{propName(e.propertyId)}</p>
                )}
              </Link>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
