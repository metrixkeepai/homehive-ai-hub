import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteShell, PageHero } from "@/components/hv/Site";
import { marketingHead } from "@/components/marketing/content";
import { photos } from "@/components/marketing/media";
export const Route = createFileRoute("/contact")({
  head: () =>
    marketingHead(
      "Contact MatrixKeep | Business Demos, Enterprise & Pilot Enquiries",
      "Talk to MatrixKeep about your business, enterprise requirements, demonstrations or pilot opportunities.",
      "/contact",
    ),
  component: Page,
});
const EMAIL = "hello@matrixkeep.com";
function Page() {
  const [f, setF] = useState({ name: "", org: "", topic: "Business demonstration", msg: "" });
  const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`MatrixKeep ${f.topic} enquiry — ${f.name}`)}&body=${encodeURIComponent(`${f.msg}\n\n${f.name}${f.org ? `, ${f.org}` : ""}`)}`;
  return (
    <SiteShell>
      <PageHero
        eyebrow="Contact & demonstrations"
        title="Your world. Your requirements. Let’s talk."
        lead="Discuss business plans, enterprise feasibility, a product demonstration or a potential pilot. Start with the information and equipment you want to bring together."
        cta="Talk to the Team"
      />
      <section className="mk-container mk-section mk-split">
        <div>
          <p className="mk-eyebrow">A useful first conversation</p>
          <h2>
            Tell us what matters
            <br />
            to your organisation.
          </h2>
          <p className="mk-lead">
            A café with essential equipment. A growing property portfolio. A team reviewing
            operational evidence. We would like to understand what you need.
          </p>
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-2 text-primary text-sm font-semibold mt-6"
          >
            <Mail className="size-4" />
            {EMAIL}
          </a>
          <img
            src={photos.enterprise}
            alt="Business team discussing operational requirements"
            width="429"
            height="407"
            loading="lazy"
            className="mt-8"
          />
        </div>
        <form
          className="space-y-5 border border-border rounded-lg bg-card p-7"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = href;
          }}
        >
          <label className="block text-sm font-semibold" htmlFor="contact-name">
            Your name
            <Input
              id="contact-name"
              required
              maxLength={100}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="mt-2"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm font-semibold" htmlFor="contact-org">
            Organisation (optional)
            <Input
              id="contact-org"
              maxLength={120}
              value={f.org}
              onChange={(e) => setF({ ...f, org: e.target.value })}
              className="mt-2"
              autoComplete="organization"
            />
          </label>
          <label className="block text-sm font-semibold" htmlFor="contact-topic">
            What would you like to discuss?
            <select
              id="contact-topic"
              className="w-full mt-2 border border-input rounded-md bg-background px-3 py-3 text-sm font-normal"
              value={f.topic}
              onChange={(e) => setF({ ...f, topic: e.target.value })}
            >
              {[
                "Individual account",
                "Business demonstration",
                "Enterprise consultation",
                "Pilot partnership",
                "White-label / licensing",
                "Support",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold" htmlFor="contact-message">
            Your message
            <Textarea
              id="contact-message"
              required
              maxLength={2000}
              rows={6}
              value={f.msg}
              onChange={(e) => setF({ ...f, msg: e.target.value })}
              className="mt-2"
            />
          </label>
          <Button type="submit" className="w-full">
            Open Email to Send
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Your email app will open with the enquiry ready to send to {EMAIL}.
          </p>
        </form>
      </section>
    </SiteShell>
  );
}
