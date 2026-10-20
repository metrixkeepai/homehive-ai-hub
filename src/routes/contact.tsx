import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteShell, PageHero } from "@/components/hv/Site";

const t = "Contact — MatrixKeep";
const d = "Talk to the MatrixKeep team about Business, Enterprise or partnerships.";
export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: t },
      { name: "description", content: d },
      { property: "og:title", content: t },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const EMAIL = "hello@matrixkeep.com";

function Page() {
  const [f, setF] = useState({ name: "", org: "", topic: "Business", msg: "" });
  const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`MatrixKeep ${f.topic} enquiry — ${f.name}`)}&body=${encodeURIComponent(`${f.msg}\n\n${f.name}${f.org ? `, ${f.org}` : ""}`)}`;
  const inp = "w-full rounded-xl border bg-background px-4 py-3 text-sm";
  return (
    <SiteShell>
      <PageHero eyebrow="Contact" title="Let’s talk." lead={d} />
      <section className="mx-auto max-w-2xl px-6 py-20">
        <form
          className="space-y-4 rounded-3xl border bg-card p-8 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = href;
          }}
        >
          <input
            required
            maxLength={100}
            placeholder="Your name"
            className={inp}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <input
            maxLength={120}
            placeholder="Organisation (optional)"
            className={inp}
            value={f.org}
            onChange={(e) => setF({ ...f, org: e.target.value })}
          />
          <select
            className={inp}
            value={f.topic}
            onChange={(e) => setF({ ...f, topic: e.target.value })}
          >
            {["Individual", "Business", "Enterprise", "White-label / partnership", "Support"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <textarea
            required
            maxLength={2000}
            rows={5}
            placeholder="How can we help?"
            className={inp}
            value={f.msg}
            onChange={(e) => setF({ ...f, msg: e.target.value })}
          />
          <button className="w-full rounded-full bg-aurora py-3 font-semibold text-primary-foreground shadow-glow">
            Open email to send
          </button>
          <p className="text-center text-xs text-muted-foreground">
            This opens your email app with your message ready to send to {EMAIL}.
          </p>
        </form>
      </section>
    </SiteShell>
  );
}
