import { ScrollStory, type ScrollStoryData } from "./ScrollStory";
import { photos } from "./media";
export { StoryBridge } from "./ScrollStory";

export const passportBirth: ScrollStoryData = {
  eyebrow: "The birth of a Digital Passport",
  title: "An ordinary asset. An extraordinary digital memory.",
  lead: "See what happens when everything about an asset comes together.",
  captions: [
    "It starts with what you own.",
    "The details are already there.",
    "Turn information into understanding.",
    "Everything finds its place.",
    "One asset. Its entire story.",
    "Know what matters. Know what's next.",
  ],
  image: photos.coffee,
  asset: "Commercial espresso machine",
  docs: [
    ["Purchase receipt", "£4,800 · 12 Mar 2025"],
    ["Supplier invoice", "Model EC-900 · Serial 4471"],
    ["Warranty", "Valid until Mar 2027"],
    ["Service record", "Descale due January"],
  ],
  fields: [
    ["Product", "Espresso machine EC-900"],
    ["Price", "£4,800"],
    ["Purchased", "12 March 2025"],
    ["Evidence", "3 documents"],
  ],
  passport: ["Digital Passport", "Espresso machine · 4 records connected"],
  insight:
    "Warranty covers the steam wand until March 2027. Book the descale before January to keep cover valid.",
  cta: { label: "Create Your First Digital Passport", to: "/auth" },
};

export function PassportBirth() {
  return <ScrollStory data={passportBirth} />;
}
