import {
  Home, Building2, DoorOpen, Package, Car, FileText, Wrench, ShieldCheck, Umbrella, Users, Bot, ListChecks,
  History, Store, MessageSquare, Plug, User, CreditCard, Lock, Eye, Bell, Settings, LifeBuoy, MapPin, UserCog, KeyRound, type LucideIcon,
} from "lucide-react";

export type Tone = "success" | "warning" | "primary" | "muted" | "danger";
export type Item = {
  id: string;
  title: string;
  subtitle: string;
  status?: [string, Tone];
  value?: string;
  fields: [string, string][];
  links?: [string, string][]; // [sectionSlug, itemId]
  timeline?: [string, string][];
  insight?: string;
  actions?: string[];
};
export type Section = {
  slug: string;
  title: string;
  group: "main" | "account";
  only?: "business";
  icon: LucideIcon;
  intro: string;
  kpis: [string, string][];
  addLabel?: string;
  addFields?: string[];
  items: Item[];
};

const tl = (...e: [string, string][]) => e;

export const sections: Section[] = [
  {
    slug: "my-home", title: "Property Profile", group: "main", icon: Building2,
    intro: "Your property profile — the foundation every agent works from.",
    kpis: [["Rooms", "9"], ["Built", "1932"], ["Floor area", "142 m²"], ["Home Health", "86"]],
    items: [
      { id: "property", title: "14 Elm Grove, Bristol", subtitle: "3-bed semi-detached · Freehold", status: ["Documented 92%", "success"],
        fields: [["Owner", "Sarah Mitchell"], ["Purchased", "Jun 2019"], ["EPC rating", "C (71)"], ["Council tax", "Band D"], ["Boiler", "Worcester Bosch 30i"], ["Roof", "Re-tiled 2017"]],
        links: [["rooms", "kitchen"], ["insurance", "home-policy"], ["maintenance", "boiler-service"]],
        timeline: tl(["Jun 2019", "Home purchased"], ["Mar 2021", "Kitchen renovated"], ["Oct 2025", "Boiler serviced"]),
        insight: "Adding your loft and garage would raise documentation to 97%.", actions: ["Edit property", "Download home report"] },
    ],
  },
  {
    slug: "rooms", title: "Rooms", group: "main", icon: DoorOpen,
    intro: "Every room, what's in it and what it needs.",
    kpis: [["Rooms", "9"], ["Items", "248"], ["Value", "£34.4k"], ["Gaps", "6"]],
    addLabel: "Add room", addFields: ["Room name", "Floor"],
    items: [
      { id: "kitchen", title: "Kitchen", subtitle: "Ground floor · 42 items", value: "£9,820", status: ["Complete", "success"],
        fields: [["Floor", "Ground"], ["Items", "42"], ["Documents", "18"], ["Last scanned", "12 Sep 2026"]],
        links: [["assets", "sage-barista"], ["assets", "bosch-dishwasher"], ["warranties", "w-bosch"]],
        timeline: tl(["12 Sep", "Room scanned — 3 new items"], ["2 Aug", "Dishwasher receipt matched"]),
        insight: "Your dishwasher filter is due a clean in 9 days.", actions: ["Scan room", "Add item"] },
      { id: "living", title: "Living room", subtitle: "Ground floor · 31 items", value: "£11,240", status: ["2 gaps", "warning"],
        fields: [["Floor", "Ground"], ["Items", "31"], ["Documents", "11"], ["Last scanned", "3 Jul 2026"]],
        links: [["assets", "samsung-tv"], ["warranties", "w-samsung"]],
        timeline: tl(["3 Jul", "Room scanned"], ["Mar 2024", "Samsung TV added"]), insight: "Sofa has no receipt — upload one for insurance.", actions: ["Scan room", "Add item"] },
      { id: "bedroom", title: "Main bedroom", subtitle: "First floor · 27 items", value: "£6,900", status: ["Complete", "success"],
        fields: [["Floor", "First"], ["Items", "27"], ["Documents", "9"]], links: [["assets", "ring-set"]], timeline: tl(["1 May", "Jewellery valued"]), actions: ["Scan room"] },
      { id: "garage", title: "Garage", subtitle: "Outbuilding · 19 items", value: "£2,150", status: ["Not scanned", "muted"],
        fields: [["Floor", "Ground"], ["Items", "19"], ["Documents", "2"]], links: [["vehicles", "golf"]], insight: "A 2-minute scan here would cover £2k of uninsured tools.", actions: ["Scan room"] },
    ],
  },
  {
    slug: "assets", title: "Assets", group: "main", icon: Package,
    intro: "Asset passports: proof, warranty, maintenance and value for everything you own.",
    kpis: [["Assets", "248"], ["Total value", "£34.4k"], ["With receipt", "81%"], ["Under warranty", "14"]],
    addLabel: "Add asset", addFields: ["Item name", "Room", "Purchase price"],
    items: [
      { id: "samsung-tv", title: "Samsung QLED 65\"", subtitle: "Living room · Electronics", value: "£1,299", status: ["Warranty ends in 26 days", "warning"],
        fields: [["Brand", "Samsung"], ["Model", "QE65Q80C"], ["Serial", "0B3K4XNR902"], ["Bought", "14 Mar 2024, Currys"], ["Replacement value", "£1,150"], ["Passport", "94% complete"]],
        links: [["rooms", "living"], ["warranties", "w-samsung"], ["documents", "doc-currys"], ["insurance", "home-policy"]],
        timeline: tl(["14 Mar 2024", "Purchased at Currys"], ["15 Mar 2024", "Receipt matched from Gmail"], ["Sep 2026", "Warranty Agent flagged expiry"]),
        insight: "Extend cover for £89/yr or report any faults before 1 Nov.", actions: ["Report issue", "Extend warranty", "Edit asset"] },
      { id: "sage-barista", title: "Sage Barista Express", subtitle: "Kitchen · Appliances", value: "£599", status: ["Descale due", "warning"],
        fields: [["Brand", "Sage"], ["Bought", "Dec 2023, John Lewis"], ["Passport", "100% complete"]], links: [["rooms", "kitchen"], ["maintenance", "descale"]],
        timeline: tl(["Dec 2023", "Purchased"]), insight: "Descaling now prevents a common pump failure.", actions: ["Mark descaled", "Edit asset"] },
      { id: "bosch-dishwasher", title: "Bosch Series 6 dishwasher", subtitle: "Kitchen · Appliances", value: "£649", status: ["Protected", "success"],
        fields: [["Bought", "Aug 2025"], ["Warranty", "Until Aug 2027"]], links: [["warranties", "w-bosch"], ["rooms", "kitchen"]], actions: ["Edit asset"] },
      { id: "ring-set", title: "Engagement ring", subtitle: "Main bedroom · Jewellery", value: "£3,800", status: ["Specified on policy", "success"],
        fields: [["Valuation", "May 2026"], ["Insurer", "Aviva"]], links: [["insurance", "home-policy"]], actions: ["Upload valuation"] },
    ],
  },
  {
    slug: "vehicles", title: "Vehicles", group: "main", icon: Car,
    intro: "MOT, tax, service history and running costs in one place.",
    kpis: [["Vehicles", "2"], ["Next MOT", "47 days"], ["Annual cost", "£3,240"], ["Mileage", "38,120"]],
    addLabel: "Add vehicle", addFields: ["Registration", "Make & model"],
    items: [
      { id: "golf", title: "VW Golf 1.5 TSI", subtitle: "WR21 KXP · Petrol", value: "£14,200", status: ["MOT in 47 days", "warning"],
        fields: [["MOT due", "22 Nov 2026"], ["Tax due", "1 Mar 2027"], ["Insurance", "Admiral, renews Jan"], ["Last service", "Apr 2026, 31,900 mi"], ["Mileage", "38,120"]],
        links: [["documents", "doc-v5c"], ["maintenance", "golf-service"]],
        timeline: tl(["Apr 2026", "Interim service"], ["Nov 2025", "MOT passed"]), insight: "Book MOT and service together to save around £40.", actions: ["Book MOT", "Log mileage"] },
      { id: "bike", title: "Brompton C Line", subtitle: "Bicycle", value: "£1,350", status: ["OK", "success"],
        fields: [["Frame no.", "BR2207719"], ["Bought", "2022"]], links: [["insurance", "home-policy"]], actions: ["Edit"] },
    ],
  },
  {
    slug: "documents", title: "Documents", group: "main", icon: FileText,
    intro: "Receipts, manuals, certificates and policies — read and filed by AI.",
    kpis: [["Documents", "412"], ["Added this month", "23"], ["Needs review", "3"], ["Storage", "1.8 GB"]],
    addLabel: "Upload document", addFields: ["Document name", "Category"],
    items: [
      { id: "doc-currys", title: "Currys receipt — Samsung TV", subtitle: "Receipt · PDF · from Gmail", status: ["Matched", "success"],
        fields: [["Merchant", "Currys"], ["Date", "14 Mar 2024"], ["Total", "£1,299.00"], ["Extracted by", "Document Agent"], ["Confidence", "98%"]],
        links: [["assets", "samsung-tv"]], timeline: tl(["15 Mar 2024", "Imported from Gmail"], ["15 Mar 2024", "Linked to asset"]), actions: ["Download", "Re-run AI extraction"] },
      { id: "doc-policy", title: "Aviva home policy 2026", subtitle: "Policy · PDF", status: ["Active", "success"],
        fields: [["Insurer", "Aviva"], ["Pages", "34"], ["Renewal", "1 Feb 2027"]], links: [["insurance", "home-policy"]], actions: ["Download", "Ask about this"] },
      { id: "doc-v5c", title: "V5C logbook — Golf", subtitle: "Vehicle · Scan", status: ["Filed", "success"], fields: [["Registration", "WR21 KXP"]], links: [["vehicles", "golf"]], actions: ["Download"] },
      { id: "doc-unknown", title: "IMG_2041.jpg", subtitle: "Unsorted · Photo", status: ["Needs review", "warning"],
        fields: [["Uploaded", "Yesterday"], ["AI guess", "Boiler service invoice (71%)"]], insight: "Looks like a HeatRight invoice. Confirm to link it to your boiler.", actions: ["Confirm AI suggestion", "Edit details"] },
    ],
  },
  {
    slug: "maintenance", title: "Maintenance", group: "main", icon: Wrench,
    intro: "A plan that keeps your home healthy and warranties valid.",
    kpis: [["Due soon", "4"], ["Overdue", "1"], ["Done this year", "18"], ["Spend 2026", "£640"]],
    addLabel: "Add task", addFields: ["Task", "Due date"],
    items: [
      { id: "boiler-service", title: "Annual boiler service", subtitle: "Due in 21 days", status: ["Due soon", "warning"],
        fields: [["Asset", "Worcester Bosch 30i"], ["Last done", "Oct 2025, HeatRight"], ["Estimated cost", "£85"], ["Why", "Required to keep 10-year warranty"]],
        links: [["my-home", "property"], ["services", "heatright"]], timeline: tl(["Oct 2025", "Serviced"], ["Oct 2024", "Serviced"]), actions: ["Book service", "Mark complete"] },
      { id: "descale", title: "Descale coffee machine", subtitle: "Overdue by 3 days", status: ["Overdue", "danger"], fields: [["Asset", "Sage Barista Express"], ["Time", "20 min"]], links: [["assets", "sage-barista"]], actions: ["Mark complete"] },
      { id: "gutters", title: "Clear gutters", subtitle: "Autumn checklist · Nov", status: ["Planned", "primary"], fields: [["Estimated cost", "£120"]], links: [["services", "gutterpro"]], actions: ["Book service", "Mark complete"] },
      { id: "golf-service", title: "Golf full service", subtitle: "Due Nov 2026", status: ["Planned", "primary"], fields: [["Garage", "Bristol VW"]], links: [["vehicles", "golf"]], actions: ["Book service"] },
    ],
  },
  {
    slug: "warranties", title: "Warranties", group: "main", icon: ShieldCheck,
    intro: "Every guarantee tracked, with reminders before cover ends.",
    kpis: [["Active", "14"], ["Expiring in 90 days", "2"], ["Value protected", "£9.6k"], ["Claims made", "1"]],
    addLabel: "Add warranty", addFields: ["Product", "Expiry date"],
    items: [
      { id: "w-samsung", title: "Samsung QLED 65\" — Currys", subtitle: "Ends 1 Nov 2026", status: ["26 days left", "warning"],
        fields: [["Provider", "Currys Care"], ["Type", "Manufacturer + retailer"], ["Covers", "Parts & labour"]], links: [["assets", "samsung-tv"], ["documents", "doc-currys"]],
        insight: "Test all HDMI ports and the panel before cover ends.", actions: ["Start a claim", "Extend cover"] },
      { id: "w-bosch", title: "Bosch dishwasher", subtitle: "Ends Aug 2027", status: ["Active", "success"], fields: [["Provider", "Bosch"]], links: [["assets", "bosch-dishwasher"]], actions: ["Start a claim"] },
      { id: "w-boiler", title: "Worcester boiler 10-year", subtitle: "Ends 2029 · service required yearly", status: ["Conditional", "primary"], fields: [["Condition", "Annual service"]], links: [["maintenance", "boiler-service"]], actions: ["Start a claim"] },
    ],
  },
  {
    slug: "insurance", title: "Insurance", group: "main", icon: Umbrella,
    intro: "Be claim-ready: policies, inventory and claims together.",
    kpis: [["Readiness", "88%"], ["Contents cover", "£50k"], ["Inventory value", "£34.4k"], ["Open claims", "0"]],
    addLabel: "Add policy", addFields: ["Insurer", "Policy number"],
    items: [
      { id: "home-policy", title: "Aviva Home — buildings & contents", subtitle: "Renews 1 Feb 2027", status: ["Claim ready 88%", "success"],
        fields: [["Policy no.", "AV-88231907"], ["Contents limit", "£50,000"], ["Single item limit", "£2,000"], ["Excess", "£250"], ["Premium", "£412/yr"]],
        links: [["documents", "doc-policy"], ["assets", "ring-set"], ["assets", "samsung-tv"]],
        insight: "Your sofa (£2,400) exceeds the single item limit — add it as a specified item.", actions: ["Start a claim", "Export inventory"] },
      { id: "claim-2025", title: "Claim: water leak (2025)", subtitle: "Settled £1,180", status: ["Closed", "muted"], fields: [["Ref", "CLM-55120"], ["Settled", "Feb 2025"]], actions: ["View letters"] },
    ],
  },
  {
    slug: "family", title: "Family", group: "main", icon: Users,
    intro: "Share your home with the people who live in it.",
    kpis: [["Members", "4"], ["Pending invites", "1"], ["Shared items", "248"]],
    addLabel: "Invite member", addFields: ["Name", "Email"],
    items: [
      { id: "sarah", title: "Sarah Mitchell", subtitle: "Owner · sarah@example.com", status: ["Owner", "primary"], fields: [["Access", "Everything"], ["Joined", "2025"]], actions: ["Edit permissions"] },
      { id: "james", title: "James Mitchell", subtitle: "Adult · james@example.com", status: ["Admin", "success"], fields: [["Access", "All except billing"]], actions: ["Edit permissions", "Remove"] },
      { id: "ella", title: "Ella (14)", subtitle: "Teen", status: ["Limited", "muted"], fields: [["Access", "Her room & tasks"]], actions: ["Edit permissions"] },
      { id: "nan", title: "Margaret Hale", subtitle: "Invited · nan@example.com", status: ["Pending", "warning"], fields: [["Invited", "2 days ago"]], actions: ["Resend invite", "Cancel invite"] },
    ],
  },
  {
    slug: "agents", title: "AI Agents", group: "main", icon: Bot,
    intro: "Your HomeVault AI team, working quietly in the background.",
    kpis: [["Agents", "6"], ["Actions this week", "142"], ["Hours saved", "11.5"], ["Needs approval", "3"]],
    items: [
      { id: "document-agent", title: "Document Agent", subtitle: "Reads and files your paperwork", status: ["Working", "success"],
        fields: [["Current task", "Matching 3 receipts from Gmail"], ["Processed this week", "23"], ["Accuracy", "97%"]],
        timeline: tl(["2 min ago", "Matched Dyson V15 receipt"], ["1 h ago", "Filed Aviva policy"]), links: [["documents", "doc-unknown"]], actions: ["Pause agent", "Adjust permissions"] },
      { id: "warranty-agent", title: "Warranty Agent", subtitle: "Watches every guarantee", status: ["Working", "success"],
        fields: [["Current task", "Checking 14 warranties"], ["Alerts sent", "2"]], links: [["warranties", "w-samsung"]], timeline: tl(["Today", "Flagged Samsung expiry"]), actions: ["Pause agent"] },
      { id: "maintenance-agent", title: "Maintenance Agent", subtitle: "Plans upkeep", status: ["Working", "success"], fields: [["Current task", "Autumn checklist"]], links: [["maintenance", "gutters"]], actions: ["Pause agent"] },
      { id: "asset-agent", title: "Asset Agent", subtitle: "Values and identifies items", status: ["Working", "success"], fields: [["Current task", "Valuing 2 kitchen items"]], links: [["assets", "sage-barista"]], actions: ["Pause agent"] },
      { id: "insurance-agent", title: "Insurance Agent", subtitle: "Keeps you claim-ready", status: ["Idle", "muted"], fields: [["Last run", "Yesterday"]], links: [["insurance", "home-policy"]], actions: ["Run now"] },
      { id: "vehicle-agent", title: "Vehicle Agent", subtitle: "MOT, tax and service", status: ["Idle", "muted"], fields: [["Last run", "Today 07:00"]], links: [["vehicles", "golf"]], actions: ["Run now"] },
    ],
  },
  {
    slug: "tasks", title: "Tasks", group: "main", icon: ListChecks,
    intro: "Everything that needs a human decision.",
    kpis: [["Open", "7"], ["Due this week", "3"], ["Completed", "41"]],
    addLabel: "Add task", addFields: ["Task", "Assign to"],
    items: [
      { id: "t1", title: "Approve receipt matches", subtitle: "From Document Agent", status: ["Today", "warning"], fields: [["Assigned", "Sarah"]], links: [["agents", "document-agent"]], actions: ["Mark complete"] },
      { id: "t2", title: "Book boiler service", subtitle: "From Maintenance Agent", status: ["This week", "primary"], fields: [["Assigned", "James"]], links: [["maintenance", "boiler-service"]], actions: ["Mark complete"] },
      { id: "t3", title: "Upload sofa receipt", subtitle: "From Insurance Agent", status: ["This week", "primary"], fields: [["Assigned", "Sarah"]], links: [["rooms", "living"]], actions: ["Mark complete"] },
    ],
  },
  {
    slug: "timeline", title: "Timeline", group: "main", icon: History,
    intro: "The full history of your home.",
    kpis: [["Events", "1,204"], ["This month", "38"]],
    items: [
      { id: "e1", title: "Receipt matched — Dyson V15", subtitle: "Today · Document Agent", fields: [["Source", "Gmail"]], links: [["agents", "document-agent"]] },
      { id: "e2", title: "Warranty alert — Samsung TV", subtitle: "Today · Warranty Agent", fields: [["Days left", "26"]], links: [["warranties", "w-samsung"]] },
      { id: "e3", title: "Boiler serviced", subtitle: "Oct 2025 · HeatRight", fields: [["Cost", "£85"]], links: [["maintenance", "boiler-service"]] },
    ],
  },
  {
    slug: "services", title: "Services", group: "main", icon: Store,
    intro: "Trusted local trades and services you've used or saved.",
    kpis: [["Saved providers", "6"], ["Bookings 2026", "4"]],
    addLabel: "Add provider", addFields: ["Business name", "Trade"],
    items: [
      { id: "heatright", title: "HeatRight Heating", subtitle: "Gas Safe engineer · ★ 4.9", fields: [["Phone", "Demo number"], ["Last used", "Oct 2025"]], links: [["maintenance", "boiler-service"]], actions: ["Request booking"] },
      { id: "gutterpro", title: "GutterPro Bristol", subtitle: "Gutters & roofing · ★ 4.7", fields: [["Typical price", "£120"]], links: [["maintenance", "gutters"]], actions: ["Request booking"] },
    ],
  },
  {
    slug: "messages", title: "Messages", group: "main", icon: MessageSquare,
    intro: "Conversations with your AI team, family and providers.",
    kpis: [["Unread", "2"], ["Threads", "9"]],
    items: [
      { id: "m1", title: "Warranty Agent", subtitle: "Your Samsung TV cover ends soon…", status: ["Unread", "primary"], fields: [["Received", "Today 08:12"]], links: [["warranties", "w-samsung"]], actions: ["Reply"] },
      { id: "m2", title: "James", subtitle: "I'll call HeatRight tomorrow", status: ["Unread", "primary"], fields: [["Received", "Yesterday"]], actions: ["Reply"] },
    ],
  },
  {
    slug: "integrations", title: "Integrations", group: "main", icon: Plug,
    intro: "Connect HomeVault to the places your home life already happens.",
    kpis: [["Connected", "2"], ["Available", "8"], ["Imported this month", "23"]],
    items: [
      { id: "gmail", title: "Gmail", subtitle: "Import receipts and warranties", status: ["Connected (demo)", "success"], fields: [["Account", "sarah@example.com"], ["Last sync", "4 min ago"], ["Imported", "214 documents"], ["Access", "Read-only, receipts only"]], links: [["agents", "document-agent"]], actions: ["Sync now", "Disconnect"] },
      { id: "gcal", title: "Google Calendar", subtitle: "Add reminders to your calendar", status: ["Connected (demo)", "success"], fields: [["Calendar", "Home"]], actions: ["Disconnect"] },
      { id: "outlook", title: "Outlook", subtitle: "Import receipts from Outlook", status: ["Not connected", "muted"], fields: [["Status", "Coming soon"]], actions: ["Connect"] },
      { id: "whatsapp", title: "WhatsApp", subtitle: "Send photos and ask questions by chat", status: ["Not connected", "muted"], fields: [["Status", "Coming soon"]], actions: ["Connect"] },
      { id: "drive", title: "Google Drive", subtitle: "Back up your vault", status: ["Not connected", "muted"], fields: [["Status", "Coming soon"]], actions: ["Connect"] },
    ],
  },
  {
    slug: "locations", title: "Locations", group: "main", only: "business", icon: MapPin,
    intro: "Every site your organisation runs — shops, offices, warehouses, depots.",
    kpis: [["Sites", "Your sites"], ["Tip", "Add each address once"]],
    addLabel: "Add location", addFields: ["Location name", "Address", "Type (shop, office, warehouse…)", "Site manager", "Opening hours"],
    items: [],
  },
  {
    slug: "team", title: "Team", group: "main", only: "business", icon: UserCog,
    intro: "The people in your organisation and what each of them can do.",
    kpis: [["Roles", "5"], ["Tip", "Give each person the lowest role they need"]],
    addLabel: "Add team member", addFields: ["Full name", "Email", "Role (Owner, Admin, Manager, Staff, Viewer)", "Location", "Job title"],
    items: [],
  },
  {
    slug: "roles", title: "Roles & permissions", group: "main", only: "business", icon: KeyRound,
    intro: "What each team role is allowed to see and change.",
    kpis: [["Roles", "5"], ["Most access", "Owner"], ["Least access", "Viewer"]],
    items: [
      { id: "owner", title: "Owner", subtitle: "Full control of the organisation", status: ["Highest", "primary"], fields: [["Assets & documents", "View, add, edit, delete"], ["Locations", "Manage all"], ["Team", "Invite, change roles, remove"], ["Billing", "Manage"]] },
      { id: "admin", title: "Admin", subtitle: "Runs day-to-day operations", status: ["High", "success"], fields: [["Assets & documents", "View, add, edit, delete"], ["Locations", "Manage all"], ["Team", "Invite and change roles below Admin"], ["Billing", "View only"]] },
      { id: "manager", title: "Manager", subtitle: "Looks after one or more locations", status: ["Medium", "success"], fields: [["Assets & documents", "View, add, edit at their locations"], ["Locations", "Their own"], ["Team", "View their location's staff"], ["Billing", "No access"]] },
      { id: "staff", title: "Staff", subtitle: "Logs equipment, receipts and faults", status: ["Standard", "muted"], fields: [["Assets & documents", "View and add at their location"], ["Locations", "View their own"], ["Team", "No access"], ["Billing", "No access"]] },
      { id: "viewer", title: "Viewer", subtitle: "Read-only, e.g. accountant or auditor", status: ["Read only", "muted"], fields: [["Assets & documents", "View only"], ["Locations", "View"], ["Team", "No access"], ["Billing", "No access"]] },
    ],
  },
  {
    slug: "profile", title: "My Profile", group: "account", icon: User,
    intro: "Your personal details.", kpis: [["Member since", "2025"], ["Plan", "Family"]],
    items: [{ id: "me", title: "Sarah Mitchell", subtitle: "sarah@example.com", status: ["Verified", "success"], fields: [["Phone", "Not added"], ["Language", "English (UK)"], ["Currency", "GBP £"], ["Time zone", "Europe/London"]], actions: ["Edit profile", "Change photo"] }],
  },
  {
    slug: "billing", title: "Subscription & Billing", group: "account", icon: CreditCard,
    intro: "Your plan, payment method and invoices. Prices shown are placeholders.",
    kpis: [["Plan", "Family"], ["Price", "£9.99/mo"], ["Renews", "1 Nov 2026"], ["Storage used", "1.8 / 50 GB"]],
    items: [
      { id: "plan", title: "Family plan", subtitle: "£9.99 / month · placeholder price", status: ["Active", "success"], fields: [["Members", "Up to 6"], ["AI agents", "All 6"], ["Storage", "50 GB"]], links: [["billing", "plans"]], actions: ["Change plan", "Cancel subscription"] },
      { id: "plans", title: "Compare plans", subtitle: "Free · Plus · Family · Premium", fields: [["Free", "£0"], ["Plus", "£4.99/mo"], ["Family", "£9.99/mo"], ["Premium", "£14.99/mo"]], actions: ["Upgrade to Premium"] },
      { id: "card", title: "Payment method", subtitle: "Visa ending 4242 (demo)", fields: [["Expires", "08/28"]], actions: ["Update card"] },
      { id: "inv-oct", title: "Invoice — Oct 2026", subtitle: "£9.99 · Paid", status: ["Paid", "success"], fields: [["Number", "HV-10231"]], actions: ["Download PDF"] },
    ],
  },
  {
    slug: "security", title: "Security", group: "account", icon: Lock,
    intro: "Keep your vault locked down.", kpis: [["2-step", "On"], ["Devices", "3"]],
    items: [
      { id: "2fa", title: "Two-step verification", subtitle: "Authenticator app", status: ["On", "success"], fields: [["Added", "Jan 2026"]], actions: ["Turn off"] },
      { id: "devices", title: "Signed-in devices", subtitle: "3 devices", fields: [["MacBook", "Bristol · now"], ["iPhone 15", "Bristol · 1h ago"], ["iPad", "London · 3d ago"]], actions: ["Sign out other devices"] },
      { id: "password", title: "Password", subtitle: "Changed 4 months ago", fields: [], actions: ["Change password"] },
    ],
  },
  {
    slug: "privacy", title: "Privacy & AI permissions", group: "account", icon: Eye,
    intro: "Decide exactly what your AI team may see and do.", kpis: [["Agents with email access", "1"], ["Data shared with third parties", "None"]],
    items: [
      { id: "ai-perms", title: "AI permissions", subtitle: "Per-agent access", fields: [["Document Agent", "Read receipts in Gmail"], ["Warranty Agent", "Read assets & documents"], ["Insurance Agent", "Read inventory"], ["Auto-actions", "Ask me first"]], actions: ["Edit permissions"] },
      { id: "export", title: "Data & export", subtitle: "Download everything", fields: [["Format", "ZIP (PDF + CSV)"]], actions: ["Request export"] },
      { id: "delete", title: "Delete account", subtitle: "Permanently remove your vault", status: ["Irreversible", "danger"], fields: [], actions: ["Delete account"] },
    ],
  },
  {
    slug: "notifications", title: "Notifications", group: "account", icon: Bell,
    intro: "Alerts from your AI team and how you receive them.", kpis: [["Unread", "3"], ["Channels", "Email, Push"]],
    items: [
      { id: "n1", title: "Samsung TV warranty ends in 26 days", subtitle: "Warranty Agent · Today", status: ["New", "primary"], fields: [], links: [["warranties", "w-samsung"]], actions: ["Mark read"] },
      { id: "n2", title: "3 receipts matched", subtitle: "Document Agent · Today", status: ["New", "primary"], fields: [], links: [["agents", "document-agent"]], actions: ["Mark read"] },
      { id: "prefs", title: "Notification settings", subtitle: "Email, push and digest", fields: [["Weekly digest", "Mondays"], ["Urgent alerts", "Push + email"], ["Quiet hours", "22:00–07:00"]], actions: ["Edit settings"] },
    ],
  },
  {
    slug: "settings", title: "Settings", group: "account", icon: Settings,
    intro: "Appearance and app preferences.", kpis: [["Theme", "Light"], ["Units", "Metric"]],
    items: [{ id: "appearance", title: "Appearance", subtitle: "Theme and density", fields: [["Theme", "Light"], ["Density", "Comfortable"]], actions: ["Change theme"] }],
  },
  {
    slug: "help", title: "Help & Support", group: "account", icon: LifeBuoy,
    intro: "Guides, answers and a human when you need one.", kpis: [["Response time", "< 4h"]],
    items: [
      { id: "guide", title: "Getting started guide", subtitle: "10 minute read", fields: [], actions: ["Open guide"] },
      { id: "contact", title: "Contact support", subtitle: "We'll reply by email", fields: [["Email", "Not set up yet"]], actions: ["Send a message"] },
    ],
  },
];

export const homeNav = { slug: "", title: "Overview", icon: Home };
export const getSection = (slug: string) => sections.find((s) => s.slug === slug);
export const getItem = (slug: string, id: string) => getSection(slug)?.items.find((i) => i.id === id);
