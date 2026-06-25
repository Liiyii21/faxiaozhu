import assert from "node:assert/strict";
import fs from "node:fs";
import { servicePages } from "../src/servicePages.js";

assert.equal(servicePages.length, 3, "prototype should expose exactly three service pages");

const expected = new Map([
  ["legal", { route: "/legal", toolName: "AI法律助手", primaryCta: "咨询律师" }],
  ["beauty", { route: "/beauty", toolName: "AI智能面诊", primaryCta: "领取完整报告" }],
  ["divination", { route: "/divination", toolName: "国学智能测算", primaryCta: "再转一次" }],
]);

for (const page of servicePages) {
  const expectation = expected.get(page.id);
  assert.ok(expectation, `unexpected page id: ${page.id}`);
  assert.ok(page.id, "page is missing id");
  assert.equal(page.route, expectation.route, `${page.id} needs its own route`);
  assert.equal(page.toolName, expectation.toolName, `${page.id} needs a clean Chinese tool name`);
  assert.equal(page.primaryCta, expectation.primaryCta, `${page.id} primary CTA should match the tool`);
  assert.ok(page.title, `${page.id} is missing title`);
  assert.ok(page.primaryCta, `${page.id} is missing primary CTA`);
  assert.ok(page.secondaryCta, `${page.id} is missing secondary CTA`);
  assert.ok(page.flowSteps.length >= 5, `${page.id} should show the sales flow`);
  assert.ok(page.actions.length >= 3, `${page.id} needs at least three clickable actions`);
  assert.ok(page.tabs.length >= 3, `${page.id} needs bottom navigation items`);
  assert.ok(page.quickActions.length >= 4, `${page.id} needs mobile quick actions`);
  assert.doesNotMatch(JSON.stringify(page), /娉|鍥|绾|鐐|�/, `${page.id} still contains mojibake`);
}

const pageIds = servicePages.map((page) => page.id).sort();
assert.deepEqual(pageIds, ["beauty", "divination", "legal"]);

const routes = servicePages.map((page) => page.route).sort();
assert.deepEqual(routes, ["/beauty", "/divination", "/legal"]);

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const motionSource = fs.readFileSync(new URL("../src/useMotionEffects.js", import.meta.url), "utf8");
const packageSource = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
const directusSource = fs.readFileSync(new URL("../src/directusApi.js", import.meta.url), "utf8");
const mockDirectusSource = fs.readFileSync(new URL("../../scripts/mock-directus-server.mjs", import.meta.url), "utf8");
const viteSource = fs.readFileSync(new URL("../vite.config.mjs", import.meta.url), "utf8");
const envSource = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const deployWorkflowSource = fs.readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

assert.match(appSource, /conversionFields/, "conversion modal fields should be configured");
assert.match(appSource, /useMotionEffects/, "app should wire anime motion effects");
assert.match(motionSource, /from "animejs"/, "motion effects should use animejs");
assert.match(motionSource, /prefers-reduced-motion/, "motion effects should respect reduced motion");
assert.match(packageSource, /"animejs"/, "animejs should be installed as a project dependency");
assert.match(viteSource, /VITE_PAGE_ID/, "standalone project should inject its page id");
assert.match(viteSource, /legal/, "legal project should open the legal page at the root URL");
assert.match(envSource, /VITE_DIRECTUS_URL=http:\/\/127\.0\.0\.1:8057/, "legal local env should point at its Directus instance");
assert.match(deployWorkflowSource, /VITE_DIRECTUS_URL:\s*\$\{\{\s*vars\.VITE_DIRECTUS_URL\s*\}\}/, "GitHub Pages build should inject the production Directus URL");
assert.match(appSource, /AuthPanel/, "account tab should render login and registration controls");
assert.match(appSource, /auth-shortcut/, "home screens should expose a visible auth shortcut");
assert.match(appSource, /登录 \/ 注册/, "auth shortcut should clearly say login/register");
assert.match(appSource, /submitLead/, "modal submissions should call the Directus lead API");
assert.match(appSource, /submitSystemEvent/, "scan and report generation actions should write system events");
assert.match(appSource, /authRequired/, "lead actions should require authentication before writing data");
assert.match(appSource, /DirectusRecordsPanel/, "account pages should render live Directus records");
assert.match(appSource, /handleRecordOpen/, "account record cards should load details from Directus");
assert.match(appSource, /scrollIntoView/, "opening a record should scroll the user to the detail card");
assert.match(appSource, /recordDetailRows/, "account record detail should show submitted field details");
assert.match(appSource, /handleRecordStatus/, "account record cards should update Directus status");
assert.match(appSource, /handleRecordUpload/, "account pages should upload files through Directus");
assert.match(appSource, /recordsBusy/, "account records should expose loading state");
assert.match(appSource, /recordsError/, "account records should expose error state");
assert.match(appSource, /selectedRecord/, "account records should expose selected detail state");
assert.match(appSource, /modal\.fields/, "modal should render configured lead fields");
assert.match(appSource, /modal\.consent/, "modal should render consent copy for lead capture");
assert.match(appSource, /beauty-sticky-actions/, "beauty should expose a sticky primary conversion action");
assert.match(appSource, /function LegalCasesPage/, "legal cases tab should render a dedicated page");
assert.match(appSource, /function LegalProfilePage/, "legal profile tab should render a dedicated page");
assert.match(appSource, /我的法律援助/, "legal profile page should use legal-aid user wording");
assert.doesNotMatch(appSource, /求助人中心/, "legal profile should not render the redundant help-center hero");
assert.doesNotMatch(appSource, /<strong>王女士<\/strong>/, "legal profile should not hard-code a fake user persona");
assert.match(appSource, /analyzeLegalCase/, "legal actions should call the model-backed legal analysis API");
assert.match(appSource, /LegalAiAnalysisPanel/, "legal pages should render AI legal analysis results");
assert.match(appSource, /legalAiAnalysis/, "legal pages should keep the latest AI legal analysis in state");
assert.doesNotMatch(appSource, /analysis\.model/, "legal analysis cards should not expose the model name in the UI");
assert.match(appSource, /openLegalDetail/, "legal detail action should open a dedicated detail flow");
assert.match(appSource, /legal-detail-sections/, "legal detail modal should render structured detail sections");
assert.match(appSource, /nextActions/, "legal detail submit should expose next-step actions");
assert.match(appSource, /id:\s*"records"/, "legal detail success should expose a direct records shortcut");
assert.match(appSource, /actionId === "records"[\s\S]*setActiveTab\(2\)/, "records shortcut should open the profile records tab");
assert.match(appSource, /actionId:\s*"detail"/, "legal detail submit should save a legal_cases record");
assert.match(appSource, /function BeautyReportPage/, "beauty report tab should render a dedicated page");
assert.match(appSource, /function BeautyAdvisorPage/, "beauty advisor tab should render a dedicated page");
assert.doesNotMatch(appSource, /<button className=\{`metric metric-\$\{item\.tone\}`\} key=\{item\.label\} type="button">/, "beauty metric buttons should have a click handler");
assert.match(appSource, /function handleAdvisorItem/, "beauty advisor cards should expose click feedback");
assert.match(appSource, /handleAdvisorItem\(title, value, note\);[\s\S]*onOpenCard\(\{/, "beauty advisor list cards should select and open details");
assert.match(appSource, /function DivinationHistoryPage/, "divination history tab should render a dedicated page");
assert.match(appSource, /function DivinationProfilePage/, "divination profile tab should render a dedicated page");
assert.match(appSource, /function openTabCardDetail/, "secondary-page cards should open a detail flow");
assert.match(appSource, /tab-card-button/, "secondary-page cards should be real clickable buttons");
assert.match(appSource, /type:\s*"card-detail"/, "secondary-page card clicks should use a dedicated detail modal type");
assert.match(appSource, /modal\.sections/, "detail modal should render structured card sections");
assert.match(appSource, /page\.id === "legal" && activeTab === 1/, "legal case tab should switch on activeTab");
assert.match(appSource, /page\.id === "beauty" && activeTab === 2/, "beauty advisor tab should switch on activeTab");
assert.match(appSource, /page\.id === "divination" && activeTab === 2/, "divination profile tab should switch on activeTab");
assert.doesNotMatch(appSource, /phone-actions\s+sticky-actions/, "legal CTAs should scroll with content instead of covering it");
assert.doesNotMatch(appSource, /divination-actions\s+sticky-actions/, "divination CTAs should scroll with content instead of covering it");
assert.doesNotMatch(appSource, /page\.id !== "beauty" &&\s*\(\s*<BottomNav/s, "beauty should also render bottom navigation");
assert.match(styleSource, /\.modal-form/, "conversion form styles should exist");
assert.match(styleSource, /\.modal-consent/, "consent row styles should exist");
assert.match(styleSource, /\.beauty-sticky-actions/, "beauty sticky CTA styles should exist");
assert.match(styleSource, /\.phone-screen\.with-bottom-nav\s+\.beauty-screen\s*\{[^}]*min-height:\s*0/s, "beauty app screen should not push bottom navigation outside the visible phone");
assert.doesNotMatch(styleSource, /\.status-bar/, "fake mobile status bar styles should be removed");
assert.doesNotMatch(styleSource, /100%\s*-\s*31px/, "content height should not reserve space for the removed status bar");
assert.doesNotMatch(styleSource, /100dvh\s*-\s*30px/, "mobile layout should not reserve space for the removed status bar");
assert.match(styleSource, /\.beauty-screen\s*\+\s*\.bottom-nav\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.96\)[^}]*rgba\(241,\s*247,\s*255,\s*0\.98\)/s, "beauty bottom navigation should use the beauty light theme");
assert.match(styleSource, /\.beauty-screen\s*\+\s*\.bottom-nav\s+\.active\s*\{[^}]*var\(--beauty-accent\)/s, "beauty bottom navigation active item should use the beauty accent");
assert.match(styleSource, /\.tab-page/, "secondary tab page styles should exist");
assert.match(styleSource, /\.tab-card/, "secondary tab cards should be styled");
assert.match(styleSource, /\.directus-records/, "Directus record panels should be styled");
assert.match(styleSource, /\.record-actions/, "Directus record actions should be styled");
assert.match(styleSource, /\.upload-row/, "Directus upload controls should be styled");
assert.doesNotMatch(styleSource, /\.sticky-actions\s*\{[^}]*position:\s*sticky/s, "CTA actions should not use sticky positioning");
assert.match(styleSource, /min-height:\s*44px/, "small tap targets should be at least 44px high");
assert.doesNotMatch(styleSource, /\.phone-frame\s*\{[^}]*border:/s, "mobile page should not render a phone shell border");
assert.doesNotMatch(styleSource, /\.phone-frame\s*\{[^}]*border-radius:/s, "mobile page should not render phone shell rounded corners");
assert.doesNotMatch(styleSource, /\.phone-frame\s*\{[^}]*box-shadow:/s, "mobile page should not render phone shell shadow");
assert.doesNotMatch(styleSource, /\.phone-stage\s*\{[^}]*place-items:\s*center/s, "mobile page should not be centered as a device mockup");
assert.match(styleSource, /--mobile-page-width:\s*430px/, "service pages should cap to mobile page width on desktop");
assert.match(styleSource, /\.phone-frame\s*\{[^}]*width:\s*min\(100vw,\s*var\(--mobile-page-width\)\)/s, "phone frame should use mobile width, not full desktop width");
assert.match(styleSource, /\.phone-screen\s*\{[^}]*width:\s*100%/s, "phone screen should fill the mobile-width frame");
assert.match(styleSource, /Anime-inspired visual polish/, "theme motion polish styles should be documented");
assert.match(styleSource, /beautyScanSweep/, "beauty scan sweep animation should exist");
assert.match(styleSource, /mysticRingTrace/, "divination wheel ring animation should exist");
assert.match(styleSource, /\.legal-screen \.ai-analysis/, "legal analysis polish should exist");

assert.match(directusSource, /VITE_DIRECTUS_URL/, "Directus base URL should come from Vite env");
assert.match(directusSource, /\/users\/register/, "Directus API layer should expose user registration");
assert.match(directusSource, /\/auth\/login/, "Directus API layer should expose login");
assert.match(directusSource, /\/auth\/refresh/, "Directus API layer should expose token refresh");
assert.match(directusSource, /\/auth\/logout/, "Directus API layer should expose logout");
assert.match(directusSource, /\/users\/me/, "Directus API layer should expose current user");
assert.match(directusSource, /\/items\/\$\{collection\}/, "Directus API layer should create collection items");
assert.match(directusSource, /export async function listUserItems/, "Directus API layer should list current user items");
assert.match(directusSource, /export async function readItem/, "Directus API layer should read item details");
assert.match(directusSource, /export async function updateItem/, "Directus API layer should update item status");
assert.match(directusSource, /export async function uploadFile/, "Directus API layer should upload files");
assert.match(directusSource, /export async function analyzeLegalCase/, "Directus API layer should expose legal AI analysis");
assert.match(directusSource, /\/ai\/legal\/analyze/, "Directus API layer should call the legal analysis API");
assert.match(directusSource, /\/files/, "Directus API layer should call the files API");
assert.match(directusSource, /legal_consultations/, "legal submissions should map to Directus collections");
assert.match(directusSource, /beauty_reports/, "beauty submissions should map to Directus collections");
assert.match(directusSource, /divination_consults/, "divination submissions should map to Directus collections");
assert.match(directusSource, /export async function submitSystemEvent/, "Directus API layer should expose system event writes");
assert.match(mockDirectusSource, /url\.pathname === "\/files"/, "local mock Directus should support file upload");
assert.match(mockDirectusSource, /url\.pathname === "\/ai\/legal\/analyze"/, "local mock Directus should support legal AI analysis");
assert.match(mockDirectusSource, /buildLegalAiAnalysis/, "local mock Directus should build legal AI analysis");
assert.match(mockDirectusSource, /callTextAiProvider/, "local mock Directus should reuse the configured OpenAI-compatible model");
assert.match(mockDirectusSource, /filter\[user_created\]\[_eq\]/, "local mock Directus should support current user item filters");

for (const path of ["../directus/docker-compose.yml", "../directus/.env.example", "../directus/README.md"]) {
  assert.ok(fs.existsSync(new URL(path, import.meta.url)), `${path} should document the local Directus backend`);
}
