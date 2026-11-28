// Read-only browser audit. Never submit a form or open a customer's shared passport.
import { chromium } from "playwright";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const base = new URL(process.argv[2]).origin;
const output = process.argv[3] || "public-copy-evidence";
await mkdir(output, { recursive: true });
const sitemap = await readFile("public/sitemap.xml", "utf8");
const routes = new Set(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname),
);
for (const file of await readdir("src/routes")) {
  if (/^[a-z-]+\.tsx$/.test(file) && file !== "index.tsx") routes.add("/" + file.slice(0, -4));
}
routes.add("/super-admin/login");
routes.add("/p/public-copy-check");
const approved = [
  ...(await readFile("src/components/marketing/HomePage.tsx", "utf8")).matchAll(
    /<StoryBridge>([^<]+)<\/StoryBridge>/g,
  ),
].map((m) => m[1]);
for (const example of ["Less searching. More knowing.", "Don't search for answers. Ask for them."])
  assert.ok(approved.includes(example));
// Brand names, industry abbreviations and terms used in illustrative records.
const names = new Set(
  "AppleCare CNC CX Combi Currys EICR EPC FL Hilti ICO LOLER MatrixKeep MIS Multideck OIDC PUWER RBAC SAML SLA SLAs SME SMEs SSO Scalivora Supabase WM Westcliff alt cleanup mo nofollow noindex webhooks Sera WhatsApp OpenAI OneDrive Gmail MacBook API APIs CSV GBP ROI FAQ QR AI onboarding lifecycle roadmap MOT HVAC Harrogate Shoreditch"
    .toLowerCase()
    .split(" "),
);
function spelling(strings) {
  const prose = strings.join("\n").replace(/https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]+/gi, "");
  const words = [
    ...new Set(prose.match(/(?<![\p{L}\d_])\p{L}+(?:['’]\p{L}+)*(?![\p{L}\d_])/gu) || []),
  ].filter((w) => w.length > 1 && !names.has(w.toLowerCase()));
  const r = spawnSync("hunspell", ["-d", "en_GB", "-l"], {
    input: words.join("\n").replaceAll("’", "'"),
    encoding: "utf8",
  });
  if (r.status !== 0) throw Error("British English spelling dictionary unavailable");
  return [...new Set(r.stdout.trim().split(/\s+/).filter(Boolean))].map((w) => "Spelling: " + w);
}
const browser = await chromium.launch();
const rows = [];
function checkText(text) {
  const prose = text.replace(
    /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]+|\b(?:[a-z0-9-]+\.)+(?:com|co\.uk|ai|org)\b|\b(?:e\.g\.|i\.e\.)/gi,
    "",
  );
  return [
    ...prose.matchAll(
      /Lesssearching|Moreknowing|Don'tsearchforanswers|Askforthem|MatrixKeepcreates|yourassets|oneplace|\b(\w+)\s+\1\b|\p{L}[.,:;!?](?=\p{L})|\.{2}(?!\.)|[!?]{2,}|\p{L} {2,}\p{L}/giu,
    ),
  ].map((m) => prose.slice(Math.max(0, m.index - 16), m.index + m[0].length + 24));
}
async function audit(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    for (const route of routes) {
      const label = (route.slice(1) || "home").replaceAll("/", "-") + "-" + viewport.width;
      const findings = [];
      try {
        const response = await page.goto(base + route, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        assert.equal(response?.status(), 200);
        await page.locator("h1,main,form").first().waitFor({ state: "attached" });
        await page.evaluate(() => document.fonts.ready);
        const menus = [];
        if (route === "/") {
          for (const button of await page.locator(".mk-desktop-nav button[aria-expanded]").all()) {
            if (await button.isVisible()) {
              await button.hover();
              const menu = page.locator("#marketing-menu");
              await menu.waitFor();
              menus.push(await menu.innerText());
            }
          }
          const open = page.getByRole("button", { name: "Open menu", exact: true });
          if (await open.isVisible()) {
            await open.click();
            const nav = page.getByRole("navigation", { name: "Mobile navigation" });
            await nav.waitFor();
            for (const summary of await nav.locator("summary").all()) await summary.click();
            menus.push(await nav.innerText());
            await page.getByRole("button", { name: "Close menu", exact: true }).click();
          }
        }
        const result = await page.evaluate(() => {
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll("script,style,svg,noscript,template").forEach((e) => e.remove());
          const text = [];
          const walk = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
          while (walk.nextNode())
            if (walk.currentNode.textContent.trim()) text.push(walk.currentNode.textContent);
          const attrs = [
            document.title,
            ...Array.from(
              document.querySelectorAll(
                "meta[name*=description],meta[property$=title],meta[property$=description],meta[name='twitter:title']",
              ),
              (e) => e.content,
            ),
          ];
          for (const e of clone.querySelectorAll("[alt],[aria-label],[placeholder]"))
            for (const k of ["alt", "aria-label", "placeholder"])
              if (e.hasAttribute(k)) attrs.push(e.getAttribute(k));
          const layout = [];
          for (const el of document.querySelectorAll("p,h1,h2,h3,h4,summary,label,li")) {
            const nodes = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let last = null;
            while (nodes.nextNode()) {
              const n = nodes.currentNode;
              if (last && /[\p{L}\p{N}.!?]$/u.test(last.data) && /^\p{L}/u.test(n.data)) {
                const a = new Range(),
                  b = new Range();
                a.setStart(last, last.length - 1);
                a.setEnd(last, last.length);
                b.setStart(n, 0);
                b.setEnd(n, 1);
                const l = a.getBoundingClientRect(),
                  r = b.getBoundingClientRect();
                if (
                  l.width &&
                  r.width &&
                  Math.abs(l.top - r.top) < 1 &&
                  Math.abs(r.left - l.right) < 1 &&
                  last.parentElement !== n.parentElement
                )
                  layout.push(last.data.slice(-22) + "|" + n.data.slice(0, 22));
              }
              last = n;
            }
          }
          const bridges = Array.from(document.querySelectorAll(".mk-bridge p"), (p) => ({
            text: p.textContent,
            words: Array.from(p.children, (e) => {
              const b = e.getBoundingClientRect();
              return [b.left, b.right, b.top];
            }),
          }));
          return {
            text,
            attrs,
            layout,
            bridges,
            visible: document.body.innerText,
            links: Array.from(clone.querySelectorAll("a[href]"), (a) => a.getAttribute("href")),
          };
        });
        result.menus = menus;
        findings.push(...spelling([...result.text, ...result.attrs, ...menus]));
        for (const t of [...result.text, ...result.attrs, ...menus]) findings.push(...checkText(t));
        findings.push(...result.layout);
        for (const href of result.links) {
          if (!href?.startsWith("/") || href.startsWith("//")) continue;
          const path = new URL(href, base).pathname.replace(/\/$/, "") || "/";
          if (!routes.has(path) && !/^\/(?:app|super-admin|api)(\/|$)/.test(path))
            findings.push("Uncovered link " + path);
        }
        if (route === "/") {
          assert.deepEqual(
            result.bridges.map((b) => b.text),
            approved,
          );
          for (const b of result.bridges)
            for (let i = 1; i < b.words.length; i++) {
              const [prev, next] = b.words.slice(i - 1, i + 1);
              if (Math.abs(prev[2] - next[2]) < 1 && next[0] - prev[1] < 1)
                findings.push("Collapsed rendered gap: " + b.text);
            }
          for (const [i, bridge] of (await page.locator(".mk-bridge").all()).entries()) {
            await bridge.scrollIntoViewIfNeeded();
            await page.waitForTimeout(950);
            await bridge.screenshot({ path: output + "/" + label + "-caption-" + i + ".png" });
          }
        }
        await writeFile(output + "/" + label + ".json", JSON.stringify(result));
        // Reveal scroll-animated sections before recording the full-page render.
        await page.evaluate(async () => {
          const h = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += h * 0.8) {
            window.scrollTo({ top: y, behavior: "instant" });
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        await page.waitForTimeout(850);
        await page.screenshot({
          path: output + "/" + label + ".jpg",
          type: "jpeg",
          quality: 42,
          fullPage: true,
          timeout: 60000,
        });
      } catch (err) {
        findings.push(String(err.message).slice(0, 350));
      }
      const issues = [...new Set(findings)];
      rows.push({ route, width: viewport.width, issues });
      console.log(label, issues.length ? JSON.stringify(issues) : "PASS");
    }
  } finally {
    await context.close();
  }
}
try {
  await Promise.all(
    [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ].map(audit),
  );
} finally {
  await browser.close();
  await writeFile(output + "/matrix.json", JSON.stringify(rows, null, 2));
}
if (rows.some((r) => r.issues.length)) process.exitCode = 1;
