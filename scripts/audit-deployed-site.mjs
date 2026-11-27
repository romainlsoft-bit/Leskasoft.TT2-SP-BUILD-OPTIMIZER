/** Read-only HTTP qualification. Missing hosting headers are warnings, never fake passes. */
const base=new URL(process.env.TT2_E2E_BASE_URL||"https://tap-titans.leskasoft.com/");
if(base.protocol!=="https:"||base.username||base.password||base.pathname!=="/")
 throw new Error("Provide an HTTPS site origin only in TT2_E2E_BASE_URL");
const routes=["/","/fr/","/uk/","/ru/","/skill-tree-optimizer/",
 "/fr/optimiseur-arbre-de-competences/","/uk/skill-tree-optimizer/","/ru/skill-tree-optimizer/"];
const checks=[],warnings=[],external=new Set();
const check=(condition,label)=>{checks.push({ok:Boolean(condition),label});};
async function get(url){
 return fetch(url,{redirect:"follow",signal:AbortSignal.timeout(20000),headers:{"user-agent":"TT2-qualification/1.0"}});
}
for(const path of routes){
 const url=new URL(path,base);
 try{
  const res=await get(url),html=await res.text();
  check(res.status===200&&res.url===url.href,path+" canonical HTTP 200 without redirect");
  check(res.headers.get("content-type")?.includes("text/html"),path+" HTML MIME");
  check(html.includes('rel="canonical" href="'+url.href+'"'),path+" self canonical");
  check(html.includes('http-equiv="Content-Security-Policy"'),path+" CSP meta");
  check(html.includes('name="referrer" content="no-referrer"'),path+" referrer meta");
  const headers=res.headers;
  for(const name of ["content-security-policy","strict-transport-security","x-content-type-options","permissions-policy"])
   if(!headers.has(name))warnings.push({path,header:name,status:"absent"});
  if(!headers.has("x-frame-options")&&!/frame-ancestors/i.test(headers.get("content-security-policy")||""))
   warnings.push({path,header:"anti-framing HTTP policy",status:"absent"});
  for(const m of html.matchAll(/<a\b[^>]*href="(https?:[^"]+)"/g)){
   const link=new URL(m[1].replaceAll("&amp;","&"));
   if(link.origin!==base.origin)external.add(link.href);
  }
 }catch(e){check(false,path+" "+e.message);}
}
try{
 const res=await get(new URL("/assets/social-card.png",base));
 check(res.ok&&res.headers.get("content-type")?.includes("image/png"),"social preview PNG reachable");
 const image=new Uint8Array(await res.arrayBuffer());
 check(image.length>=24&&image[0]===137&&image[1]===80&&image[2]===78&&image[3]===71,"social preview PNG signature");
}catch(e){check(false,"social preview: "+e.message);}
for(const path of ["/robots.txt","/sitemap.xml"]){
 try{
  const res=await get(new URL(path,base)),body=await res.text();
  check(res.ok,path+" reachable");
  if(path==="/sitemap.xml")for(const route of routes)
   check(body.includes("<loc>"+new URL(route,base).href+"</loc>"),route+" in sitemap");
  else check(body.includes("Sitemap: "+new URL("/sitemap.xml",base).href),"robots sitemap reference");
 }catch(e){check(false,path+" "+e.message);}
}
try{
 const res=await get(new URL("http://"+base.host+"/"));
 check(new URL(res.url).protocol==="https:","HTTP redirects to HTTPS");
 await res.body?.cancel();
}catch(e){check(false,"HTTPS redirect: "+e.message);}
const externalLinks=[];
if(process.argv.includes("--external"))for(const url of external){
 try{
  const res=await get(url);
  externalLinks.push({url,status:res.status,finalUrl:res.url,needsReview:!res.ok||res.redirected});
  await res.body?.cancel();
 }catch(e){externalLinks.push({url,needsReview:true,error:e.message});}
}
console.log(JSON.stringify({origin:base.origin,checkedAt:new Date().toISOString(),
 checks,hostingHeaderWarnings:warnings,externalLinks,
 externalLinksChecked:process.argv.includes("--external"),
 fieldCoreWebVitalsVerified:false,searchIndexVerified:false},null,2));
if(checks.some(x=>!x.ok))process.exitCode=1;
