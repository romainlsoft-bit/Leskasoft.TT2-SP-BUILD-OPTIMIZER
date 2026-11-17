import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const base="https://tap-titans.leskasoft.com";
const routes={
 en:{file:"skill-tree-optimizer/index.html",route:"/skill-tree-optimizer/",home:"index.html"},
 fr:{file:"fr/optimiseur-arbre-de-competences/index.html",route:"/fr/optimiseur-arbre-de-competences/",home:"fr/index.html"},
 uk:{file:"uk/skill-tree-optimizer/index.html",route:"/uk/skill-tree-optimizer/",home:"uk/index.html"},
 ru:{file:"ru/skill-tree-optimizer/index.html",route:"/ru/skill-tree-optimizer/",home:"ru/index.html"}
};
const get=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Every supported language has one static, indexable, non-duplicated TT2 guide",()=>{
 for(const [lang,route] of Object.entries(routes)){
  const html=get(route.file);
  assert.match(html,new RegExp('<html lang="'+lang+'">'));
  assert.equal((html.match(/<h1>/g)||[]).length,1,lang+" needs one H1");
  assert.equal((html.match(/<main /g)||[]).length,1,lang+" must have semantic main");
  assert.ok(html.includes('<link rel="canonical" href="'+base+route.route+'">'),lang);
  assert.ok(html.includes('<meta name="robots" content="index,follow">'),lang);
  assert.ok(html.includes("Necrobear"),lang+" should describe late-game account imports");
  assert.ok(html.includes("Chesterson"),lang+" should name the gold source");
  assert.ok(html.includes('<a class="btn primary guide-cta" href="'),lang+" should link to the actual calculator");
  assert.ok(html.includes('guide.css'),lang+" missing guide styling");
  for(const [other,otherRoute] of Object.entries(routes)){
   assert.ok(html.includes('hreflang="'+other+'" href="'+base+otherRoute.route+'"'),lang+" -> "+other);
  }
  assert.ok(html.includes('hreflang="x-default" href="'+base+routes.en.route+'"'));
  const description=html.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(description,lang+" missing static description");
  assert.ok(description[1].length<=165,lang+" meta description too long");
  assert.ok(get(route.home).includes('href="'+route.route+'"'),lang+" homepage must link to the guide");
  // Without JavaScript the complete guide content is still indexable.
  assert.ok(html.indexOf("<h2>")>0 && html.indexOf("<h3>")>0,lang+" content not rendered");
 }
});
test("Sitemap includes and does not duplicate all four localized guide URLs",()=>{
 const xml=get("sitemap.xml");
 for(const {route} of Object.values(routes)){
  const url="<loc>"+base+route+"</loc>";
  assert.equal(xml.split(url).length-1,1,url);
 }
});
test("Guide FAQ structured data accurately describes questions visible on the page",()=>{
 for(const [lang,route] of Object.entries(routes)){
  const html=get(route.file);
  const block=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block,lang+" missing schema");
  const graph=JSON.parse(block[1])["@graph"];
  const webPage=graph.find(e=>e["@type"]==="WebPage");
  const faq=graph.find(e=>e["@type"]==="FAQPage");
  const breadcrumbs=graph.find(e=>e["@type"]==="BreadcrumbList");
  assert.equal(webPage.url,base+route.route);
  assert.equal(webPage.inLanguage,lang);
  assert.ok(breadcrumbs.itemListElement.length===2);
  assert.ok(faq.mainEntity.length===3);
  for(const row of faq.mainEntity){
   assert.equal(row["@type"],"Question");
   assert.equal(row.acceptedAnswer["@type"],"Answer");
   assert.ok(row.acceptedAnswer.text.length>30);
   assert.ok(html.includes(row.name),lang+" invisible FAQ question: "+row.name);
  }
 }
});
test("Source research documents the no-manual-entry promise and qualification boundary",()=>{
 const research=get("docs/SEO_KEYWORDS.md");
 const gate=get("docs/ACCOUNT_ENGINE_RELEASE_GATE.md");
 assert.ok(research.includes("SP optimizer"));
 assert.ok(research.includes("Necrobear"));
 assert.ok(research.includes("not automatically equip pets or gear"));
 assert.ok(gate.includes("The public release gate remains closed"));
});
