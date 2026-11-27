import {test,expect} from "@playwright/test";

test("CSP blocks inline scripts and the real module worker and styles still function",async({page})=>{
 await page.addInitScript(()=>{
  window.tt2CspViolations=[];
  document.addEventListener("securitypolicyviolation",event=>
   window.tt2CspViolations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
 });
 const response=await page.goto("/");
 expect(response?.ok()).toBe(true);
 await expect(page.locator("[data-damage]")).toHaveCount(6);
 // A benign injected script must be rejected by the browser's CSP.
 await page.evaluate(()=>{
  const script=document.createElement("script");
  script.textContent="window.tt2InlineProbe=true";
  document.body.append(script);
 });
 await expect.poll(()=>page.evaluate(()=>window.tt2CspViolations.some(v=>v.blocked==="inline"&&v.directive.startsWith("script-src")))).toBe(true);
 expect(await page.evaluate(()=>window.tt2InlineProbe)).toBeUndefined();
 await page.evaluate(()=>{window.tt2CspViolations.length=0;});
 await page.locator("#skill-points").fill("100");
 await page.locator("#qol-mode").selectOption("none");
 await page.locator("#optimize-button").click();
 await expect(page.locator("#actual-results")).toBeVisible({timeout:45000});
 await expect(page.locator("#branch-chart .progress-fill")).toHaveCount(6);
 const bars=await page.locator("#branch-chart .progress-fill").evaluateAll(nodes=>nodes.map(el=>({width:el.style.width,rendered:el.getBoundingClientRect().width})));
 expect(bars.some(bar=>bar.width==="100%"&&bar.rendered>0)).toBe(true);
 expect(await page.evaluate(()=>window.tt2CspViolations)).toEqual([]);
});

test("mobile navigation records laboratory timings, without asserting field Core Web Vitals",async({page},testInfo)=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>{
  window.tt2Lab={lcp:null,cls:0};
  try{new PerformanceObserver(list=>{
   for(const e of list.getEntries())window.tt2Lab.lcp=e.startTime;
  }).observe({type:"largest-contentful-paint",buffered:true});}catch{}
  try{new PerformanceObserver(list=>{
   for(const e of list.getEntries())if(!e.hadRecentInput)window.tt2Lab.cls+=e.value;
  }).observe({type:"layout-shift",buffered:true});}catch{}
 });
 await page.goto("/fr/");
 await expect(page.locator("[data-damage]")).toHaveCount(6);
 await page.waitForLoadState("load");
 const metrics=await page.evaluate(()=>{
  const n=performance.getEntriesByType("navigation")[0];
  const modules=performance.getEntriesByType("resource").filter(e=>new URL(e.name).pathname.endsWith(".js"));
  return {navigationMs:n.duration,domContentLoadedMs:n.domContentLoadedEventEnd,
   firstContentfulPaintMs:performance.getEntriesByName("first-contentful-paint")[0]?.startTime??null,
   lcpObservedMs:window.tt2Lab.lcp,layoutShiftSumObserved:window.tt2Lab.cls,
   moduleRequests:modules.length,moduleDecodedBytes:modules.reduce((sum,e)=>sum+e.decodedBodySize,0)};
 });
 expect(metrics.moduleRequests).toBeGreaterThan(0);
 await testInfo.attach("lab-navigation-metrics",{body:JSON.stringify(metrics,null,2),contentType:"application/json"});
});
