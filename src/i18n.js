// Human-reviewed UI strings: English is always the default unless explicitly
// selected using the language picker or a supported ?lang= URL parameter.
// Skill identifiers, game JSON and equipment-set IDs are never translated.
export const SUPPORTED_LANGUAGES = ["en","fr","uk","ru"];
export const NATIVE_LANGUAGE_NAMES = {en:"English",fr:"Français",uk:"Українська",ru:"Русский"};
// Catalogs are independent; English uses the source messages.
export const translations=Object.create(null);
const loaders=Object.freeze({
 fr:()=>import("./i18n-fr.js?v=20261123-boss-specials-r1&locale=20261127-audit56-r1&poisonsprout=20261127-r1"),
 uk:()=>import("./i18n-uk.js?v=20261123-boss-specials-r1&locale=20261127-audit56-r1&poisonsprout=20261127-r1"),
 ru:()=>import("./i18n-ru.js?v=20261123-boss-specials-r1&locale=20261127-audit56-r1&poisonsprout=20261127-r1")
});
const pending=new Map();

export async function loadLocale(lang="en"){
 if(!Object.hasOwn(loaders,lang))return "en";
 if(Object.hasOwn(translations,lang))return lang;
 if(!pending.has(lang)){
  pending.set(lang,loaders[lang]().then(module=>{
   translations[lang]=module.default;
   return lang;
  }).finally(()=>pending.delete(lang)));
 }
 return pending.get(lang);
}

export function t(message, lang="en", parameters={}){
  const selected=SUPPORTED_LANGUAGES.includes(lang)?lang:"en";
  const value=Object.hasOwn(translations[selected]??{},message)?translations[selected][message]:message;
  return value.replace(/\{(\w+)\}/g,(_,key)=>parameters[key]===undefined?"{"+key+"}":String(parameters[key]));
}
const originals=new WeakMap();
const attrs=new WeakMap();
function originalText(node){
  if(!originals.has(node))originals.set(node,node.nodeValue);
  return originals.get(node);
}
export function localizeDocument(doc=document,lang="en"){
  doc.documentElement.lang=SUPPORTED_LANGUAGES.includes(lang)?lang:"en";
  const iterator=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
  for(let node=iterator.nextNode();node;node=iterator.nextNode()){
    if(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"].includes(node.parentElement?.tagName))continue;
    // Dynamic widgets are rendered by app.js from canonical game identifiers.
    // Do not overwrite them with original static English markup when switching languages.
    if(node.parentElement?.closest("#source-label,#status,#result-mode,#damage-choices,#gold-choices,#equipment-choices,#skill-editor,#build-title,#build-subtitle,#spent,#remaining,#change-count,#branch-chart,#full-tree,#diff-list,#delta-count,.math-disclaimer"))continue;
    const source=originalText(node),trimmed=source.trim();
    if(!trimmed)continue;
    const translated=t(trimmed,lang);
    if(translated===trimmed){node.nodeValue=source;continue;}
    const left=source.match(/^\s*/)?.[0]??"",right=source.match(/\s*$/)?.[0]??"";
    node.nodeValue=left+translated+right;
  }
  for(const element of doc.querySelectorAll("[placeholder],[aria-label],[title]")){
    let map=attrs.get(element);
    if(!map){map={};attrs.set(element,map);}
    for(const key of ["placeholder","aria-label","title"]){
      if(!element.hasAttribute(key))continue;
      if(map[key]===undefined)map[key]=element.getAttribute(key);
      element.setAttribute(key,t(map[key],lang));
    }
  }
  const title="TT2 Skill Tree Optimizer 8.4 — Free Skill Point Calculator | Leskasoft";
  doc.title=t(title,lang);
  const description="Free Tap Titans 2 skill tree optimizer for TT2 8.4. Optimize skill points for Clan Ship, Pet, Shadow Clone, Heavenly Strike, Dagger or Gold Gun. Import game data or configure manually.";
  const meta=doc.querySelector('meta[name="description"]');
  if(meta && !meta.hasAttribute("data-static-localized"))meta.content=t(description,lang);
}
