import {test,expect} from "@playwright/test";

const storageKey="tt2_skill_optimizer_v1";
const syntheticExport={
 Version:"8.4.0",Skills:{TapDmg:1},
 playerStats:{"Skill Points Owned":100,"Max Prestige Stage":1000,
  typeDamage:"Pet",typeGold:"Fairy",PlayerName:"TT2_E2E_SYNTHETIC_ID"}
};
const hashFor=payload=>"#build="+Buffer.from(JSON.stringify(payload),"utf8").toString("base64");
const hostile='"><img src=x onerror="window.__tt2Injected=true">';
const routes=[
 ["/","en","/skill-tree-optimizer/"],
 ["/fr/","fr","/fr/optimiseur-arbre-de-competences/"],
 ["/uk/","uk","/uk/skill-tree-optimizer/"],
 ["/ru/","ru","/ru/skill-tree-optimizer/"]
];
const canonicalOrigin="https://tap-titans.leskasoft.com";

async function openOptimizer(page,path="/"){
 const response=await page.goto(path);
 expect(response?.ok()).toBe(true);
 await expect(page.locator("[data-damage]")).toHaveCount(6);
}
async function pasteExport(page,raw=JSON.stringify(syntheticExport)){
 await page.locator("#paste-details summary").click();
 await page.locator("#import-json").fill(raw);
 await page.locator("#import-button").click();
}
async function optimize(page){
 await page.locator("#qol-mode").selectOption("none");
 await page.locator("#optimize-button").click();
 await expect(page.locator("#actual-results")).toBeVisible({timeout:45000});
 const build=JSON.parse(await page.locator("#export-json").inputValue());
 expect(Object.keys(build.Skills)).toHaveLength(72);
 expect(Object.values(build.Skills).every(n=>Number.isSafeInteger(n)&&n>=0)).toBe(true);
 expect(build.Version).toBe("8.4.0");
 return build;
}
async function allowClipboard(page,context){
 await context.grantPermissions(["clipboard-read","clipboard-write"],{origin:new URL(page.url()).origin});
}
test("manual JSON import, real worker, budget, clipboard export and private share round-trip",async({page,context})=>{
 await openOptimizer(page);
 await allowClipboard(page,context);
 const requests=[];
 page.on("request",r=>requests.push(r.url()));
 await pasteExport(page);
 await expect(page.locator("#skill-points")).toHaveValue("100");
 await expect(page.locator("#import-json")).toHaveValue("");
 const build=await optimize(page);
 const spent=Number((await page.locator("#spent").innerText()).replace(/[^0-9]/g,""));
 const remaining=Number((await page.locator("#remaining").innerText()).replace(/[^0-9]/g,""));
 expect(spent).toBeGreaterThan(0);
 expect(spent+remaining).toBe(100);
 await page.locator("#copy-build").click();
 await expect(page.locator("#status")).toHaveClass(/success/);
 expect(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()))).toEqual(build);
 await page.locator("#share-build").click();
 await expect(page.locator("#status")).toContainText("Shareable link copied");
 const url=await page.evaluate(()=>navigator.clipboard.readText());
 const decoded=JSON.parse(Buffer.from(new URL(url).hash.slice(7),"base64").toString("utf8"));
 expect(decoded.sp).toBe(100);
 expect(decoded).not.toHaveProperty("accountProfile");
 expect(decoded).not.toHaveProperty("selectedEquipment");
 expect(JSON.stringify(decoded)).not.toContain("TT2_E2E_SYNTHETIC_ID");
 const origin=new URL(page.url()).origin;
 expect(requests.filter(u=>/^https?:/.test(u)&&new URL(u).origin!==origin)).toEqual([]);
 const recipient=await context.browser().newContext();
 try{
  const fresh=await recipient.newPage();
  await openOptimizer(fresh,url);
  await expect(fresh.locator("#skill-points")).toHaveValue("100");
  await expect(fresh.locator("#status")).toContainText("Shared build settings loaded");
  expect(JSON.parse(await fresh.evaluate(k=>localStorage.getItem(k),storageKey)).accountProfile).toBeNull();
 }finally{await recipient.close();}
});
test("clipboard import and file upload",async({page,context})=>{
 await openOptimizer(page);
 await allowClipboard(page,context);
 await page.evaluate(raw=>navigator.clipboard.writeText(raw),JSON.stringify(syntheticExport));
 await page.locator("#paste-button").click();
 await expect(page.locator("#skill-points")).toHaveValue("100");
 await page.locator("#upload-file").setInputFiles({
  name:"synthetic.json",mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify({...syntheticExport,playerStats:{"Skill Points Owned":125}}))
 });
 await expect(page.locator("#skill-points")).toHaveValue("125");
});
test("invalid JSON reports an error without corrupting existing settings",async({page})=>{
 await openOptimizer(page);
 await page.locator("#skill-points").fill("100");
 await page.locator("#skill-points").blur();
 await pasteExport(page,"{invalid json");
 await expect(page.locator("#status")).toHaveClass(/error/);
 await expect(page.locator("#app-toast")).toBeVisible();
 await expect(page.locator("#skill-points")).toHaveValue("100");
});
test("malicious shared build is rejected without DOM injection",async({page})=>{
 await openOptimizer(page,"/"+hashFor({sp:100,cur:{TapDmg:hostile}}));
 await expect(page.locator("#status")).toHaveClass(/error/);
 await page.locator("#advanced-settings summary").click();
 await expect(page.locator('[data-level="TapDmg"]')).toHaveValue("0");
 expect(await page.evaluate(()=>window.__tt2Injected)).toBeUndefined();
 expect(await page.locator("#skill-editor img").count()).toBe(0);
});
test("hostile saved state is sanitized and erase removes imported profile",async({page})=>{
 await page.addInitScript(({key,hostile})=>{
  if(sessionStorage.getItem("e2eSeeded"))return;
  sessionStorage.setItem("e2eSeeded","1");
  localStorage.setItem(key,JSON.stringify({skillPoints:100,currentLevels:{TapDmg:hostile}}));
 },{key:storageKey,hostile});
 await openOptimizer(page);
 await page.locator("#advanced-settings summary").click();
 await expect(page.locator('[data-level="TapDmg"]')).toHaveValue("0");
 expect(await page.evaluate(()=>window.__tt2Injected)).toBeUndefined();
 await pasteExport(page);
 expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey)).accountProfile).not.toBeNull();
 page.once("dialog",d=>d.accept());
 await Promise.all([page.waitForEvent("load"),page.locator("#clear-local-data").click()]);
 await expect(page.locator("[data-damage]")).toHaveCount(6);
 const saved=await page.evaluate(k=>localStorage.getItem(k),storageKey);
 // Initialization may write a new blank preference record; no imported data may remain.
 if(saved)expect(JSON.parse(saved).accountProfile).toBeNull();
});
test("language switch changes URL and preserves entered SP",async({page})=>{
 await openOptimizer(page);
 await page.locator("#skill-points").fill("100");
 await page.locator("#skill-points").blur();
 await page.locator("#language-select").selectOption("fr");
 await expect(page).toHaveURL(/\/fr\/$/);
 await expect(page.locator("html")).toHaveAttribute("lang","fr");
 await expect(page.locator("#skill-points")).toHaveValue("100");
});
for(const [path,lang,guide] of routes){
 test("locale "+lang+": load, keyboard, help, guide and SEO",async({page})=>{
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await openOptimizer(page,path);
  await expect(page.locator("html")).toHaveAttribute("lang",lang);
  await expect(page.locator("#language-select")).toHaveValue(lang);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href",canonicalOrigin+path);
  await expect(page.locator("link[rel=alternate][hreflang]")).toHaveCount(5);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.locator("#export-help-button").click();
  await expect(page.locator("#export-help-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#export-help-dialog")).not.toBeVisible();
  await expect(page.locator(".guide-nav-link")).toHaveAttribute("href",guide);
  await page.locator(".guide-nav-link").click();
  await expect(page.locator("html")).toHaveAttribute("lang",lang);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href",canonicalOrigin+guide);
  expect(errors).toEqual([]);
 });
 test("locale "+lang+": 360px viewport without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await openOptimizer(page,path);
  await page.locator("#advanced-settings summary").click();
  const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
  expect(width.content).toBeLessThanOrEqual(width.viewport+1);
 });
}
test("all eight public pages, same-origin navigation links, sitemap and robots respond",async({page,request,baseURL})=>{
 const origin=new URL(baseURL).origin;
 const paths=routes.flatMap(([p,,g])=>[p,g]);
 const checked=new Set();
 for(const path of paths){
  const res=await page.goto(path);
  expect(res?.ok(),path).toBe(true);
  await expect(page.locator("h1")).toHaveCount(1);
  const links=await page.locator("a[href],link[rel=stylesheet],script[src]").evaluateAll(nodes=>nodes.map(n=>n.href||n.src));
  for(const href of links){
   const url=new URL(href);
   if(url.origin!==origin)continue;
   if(url.hash&&url.pathname===new URL(page.url()).pathname){
    const target=decodeURIComponent(url.hash.slice(1));
    expect(await page.evaluate(id=>!!document.getElementById(id),target),href).toBe(true);
   }
   url.hash="";
   if(checked.has(url.href))continue;
   checked.add(url.href);
   expect((await request.get(url.href)).ok(),url.href).toBe(true);
  }
 }
 const sitemap=await request.get("/sitemap.xml");
 expect(sitemap.ok()).toBe(true);
 const xml=await sitemap.text();
 for(const path of paths)expect(xml).toContain("<loc>"+canonicalOrigin+path+"</loc>");
 expect((await request.get("/robots.txt")).ok()).toBe(true);
});
