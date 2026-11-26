import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const SITE="https://tap-titans.leskasoft.com";
const LANGS=["en","fr","uk","ru"];
const content=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const pages=Object.fromEntries(LANGS.map(lang=>[lang,content(lang==="en"?"index.html":lang+"/index.html")]));
const sitemap=content("sitemap.xml");
const robots=content("robots.txt");
const app=content("src/app.js");
const css=content("styles.css");
const routes=Object.fromEntries(LANGS.map(lang=>[lang,SITE+"/"+(lang==="en"?"":lang+"/")]));

test("Each language serves its own semantic, static HTML",()=>{
 for(const lang of LANGS){
  const html=pages[lang],url=routes[lang];
  assert.match(html,new RegExp('<html lang="'+lang+'">'));
  assert.match(html,/<h1>[^<]+<\/h1>/);
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.ok(html.includes('<link rel="canonical" href="'+url+'">'),lang+" canonical");
  assert.ok(html.includes('<meta property="og:url" content="'+url+'">'),lang+" og:url");
  assert.ok(html.includes('<meta name="description"'),lang+" description");
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(schema["@type"],"WebApplication");
  assert.equal(schema.inLanguage,lang);
  assert.equal(schema.url,url);
  assert.ok(!schema.aggregateRating,"Never invent ratings");
  assert.equal((html.match(/<section class="panel/g)||[]).length,3);
  assert.ok(html.indexOf('class="panel setup"')<html.indexOf('class="panel preferences"'));
  assert.ok(html.indexOf('class="panel preferences"')<html.indexOf('class="panel results"'));
 }
});
test("French / Ukrainian / Russian text is indexable without JavaScript",()=>{
 assert.match(pages.fr,/<h1>Optimiseur d’arbre de compétences Tap Titans 2<\/h1>/);
 assert.match(pages.uk,/<h1>Оптимізатор дерева навичок Tap Titans 2<\/h1>/);
 assert.match(pages.ru,/<h1>Оптимизатор дерева навыков Tap Titans 2<\/h1>/);
 for(const lang of ["fr","uk","ru"]){
  assert.ok(!pages[lang].includes("<h1>Tap Titans 2 Skill Tree Optimizer</h1>"));
  assert.match(pages[lang],/src="\.\.\/src\/app\.js\?v=20\d{6}-[a-z0-9-]+(?:&amp;[a-z]+=[a-z0-9-]+)*"/);
  assert.match(pages[lang],/href="\.\.\/styles\.css\?v=20\d{6}-[a-z0-9-]+(?:&amp;[a-z]+=[a-z0-9-]+)*"/);
  assert.ok(pages[lang].includes('href="../assets/favicon.svg"'));
  assert.ok(pages[lang].includes('data-static-localized="true"'));
 }
});
test("All pages provide reciprocal hreflang with x-default",()=>{
 for(const [lang,html] of Object.entries(pages)){
  for(const [variant,url] of Object.entries(routes)){
   assert.ok(html.includes('rel="alternate" hreflang="'+variant+'" href="'+url+'"'),lang+" -> "+variant);
  }
  assert.ok(html.includes('hreflang="x-default" href="'+routes.en+'"'));
 }
});
test("Google sitemap lists only canonical URLs and robots references it",()=>{
 for(const url of Object.values(routes))assert.ok(sitemap.includes("<loc>"+url+"</loc>"));
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 assert.equal(urls.length,8,"4 localized root pages + 4 SEO guide pages");
 assert.equal(new Set(urls).size,8,"no duplicate canonical URLs");
 for(const url of urls)assert.ok(url.startsWith(SITE+"/"));
 for(const suffix of ["/skill-tree-optimizer/",
  "/fr/optimiseur-arbre-de-competences/",
  "/uk/skill-tree-optimizer/","/ru/skill-tree-optimizer/"])
  assert.ok(urls.includes(SITE+suffix));
 assert.ok(robots.includes("Sitemap: "+SITE+"/sitemap.xml"));
 assert.ok(!pages.en.includes('name="robots" content="noindex'));
});
test("Page navigation preserves language, no dependence on dynamic ?lang indexing",()=>{
 assert.ok(app.includes('function localizedUrl(lang)'));
 assert.ok(app.includes("location.assign(localizedUrl(lang))"));
 assert.ok(app.includes("location.replace(localizedUrl(desired))"));
 assert.ok(app.includes('params.delete("lang")'));
 assert.ok(css.includes(".workspace{display:flex;flex-direction:column"));
});
test("Document is neutral and references methodology instead of promotional sections",()=>{
 for(const html of Object.values(pages)){
  assert.ok(html.includes('class="methodology"'));
  assert.ok(html.includes("MATH_AUDIT.md"));
  assert.ok(!html.includes('class="hero"'));
  assert.ok(!html.includes('class="seo"'));
 }
});
