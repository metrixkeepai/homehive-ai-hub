import { createFileRoute } from "@tanstack/react-router";
import { Camera, Mic, Mail, Receipt, ShieldCheck, Wrench, Car, Bot, FileImage, Search, Bell, Users } from "lucide-react";
import { SiteShell, PageHero, FeatureGrid, Steps, CTA } from "@/components/hv/Site";

const t = "Features — MatrixKeep";
const d = "Capture anything, let AI organise it, and get told what’s next: warranties, renewals, maintenance and evidence.";
export const Route = createFileRoute("/features")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => (
    <SiteShell>
      <PageHero eyebrow="Features" title="Capture it once." accent="We’ll keep it." lead={d} />
      <FeatureGrid title="Add anything, any way." items={[
        { icon: Camera, t: "Photo & room scan", d: "AI identifies items and creates records from a single photo." },
        { icon: Receipt, t: "Receipt scan", d: "Shop, price, date and item pulled straight from a receipt." },
        { icon: Mic, t: "Speak it", d: "Describe what you bought and MatrixKeep writes it down." },
        { icon: Mail, t: "Email import", d: "Paste an order email to create linked records." },
      ]} />
      <FeatureGrid title="Then MatrixKeep watches what happens next." items={[
        { icon: ShieldCheck, t: "Warranty & renewal intelligence", d: "Expiries, renewals and cover gaps surfaced early." },
        { icon: Wrench, t: "Maintenance", d: "Recurring jobs and service history." },
        { icon: Car, t: "Vehicles & fleet", d: "MOT, tax, servicing and insurance." },
        { icon: FileImage, t: "Evidence vault", d: "Photos and PDFs attached to every record, with a full-screen viewer." },
        { icon: Bot, t: "Sera, your AI assistant", d: "Ask questions about your own records in plain English." },
        { icon: Search, t: "Instant search", d: "Find any item, document or date in seconds." },
        { icon: Bell, t: "Smart reminders", d: "Notifications before things are due." },
        { icon: Users, t: "Sharing & roles", d: "Household members or business team roles." },
      ]} />
      <Steps steps={[["Capture", "Photo, receipt, voice or email."], ["Organise", "AI links items, rooms, documents and dates."], ["Act", "Clear next steps, before they’re urgent."]]} />
      <CTA title="See it with your own things." lead="Start free and add your first item in seconds." />
    </SiteShell>
  ),
});
