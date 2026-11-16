import {SKILLS,SKILL_IDS,BRANCH_NAMES,SETS,PRESETS,DAMAGE_TYPES,GOLD_TYPES,GAME_VERSION,parseExport,exportBuild,spentPoints} from "./engine.js";
import { t, localizeDocument, SUPPORTED_LANGUAGES } from "./i18n.js";
import { readClipboardText } from "./clipboard.js";
const $=id=>document.getElementById(id);
let locale="en";
let lastStatus={message:"Import your account or enter your skill points to begin.",type:"",params:{}};
const tr=(message,params={})=>t(message,locale,params);
const numberText=value=>Number(value).toLocaleString({en:"en-US",fr:"fr-FR",uk:"uk-UA",ru:"ru-RU"}[locale]);
function setLocale(next){
 locale=SUPPORTED_LANGUAGES.includes(next)?next:"en";
 try{localStorage.setItem("tt2_site_language",locale)}catch{}
 $("language-select").value=locale;
 localizeDocument(document,locale);
 // Main Leskasoft site uses the same four locale codes as this optimizer.
 const leskasoft=$("leskasoft-link");
 if(leskasoft)leskasoft.href="https://www.leskasoft.fr/"+locale;
 renderChoices();renderEditor($("skill-search").value);
 $("source-label").textContent=tr(state.sourceImported?"Imported from TT2":"Manual setup");
 $("result-mode").textContent=lastResult?(lastResult.solver==="bounded-grid-dp"?tr("Optimized · bounded grid"):tr("Optimized · exact DP")):tr("Ready when you are");
 if(lastResult)renderResults(lastResult,false);
 status(lastStatus.message,lastStatus.type,lastStatus.params);
 if(!worker)resetOptimizeButton();
 else $("optimize-button").textContent=tr("Cancel optimization");
}
// Stable, crawlable static HTML per language. Keep URLs relative so the same
// code also works under the repository subpath on github.io.
function localizedUrl(lang){
 const current=new URL(location.href);
 const segments=current.pathname.split("/").filter(Boolean);
 if(segments.at(-1)==="index.html")segments.pop();
 if(["fr","uk","ru"].includes(segments.at(-1)))segments.pop();
 const prefix="/"+segments.join("/")+(segments.length?"/":"");
 const path=prefix+(lang==="en"?"":lang+"/");
 const params=new URLSearchParams(current.search);
 params.delete("lang");
 return current.origin+path+(params.size?"?"+params.toString():"")+current.hash;
}
function changeLanguage(lang){
 if(!SUPPORTED_LANGUAGES.includes(lang))return;
 readInputs();persist();
 try{localStorage.setItem("tt2_site_language",lang)}catch{}
 location.assign(localizedUrl(lang));
}
function engineError(message){
 const value=String(message||"Optimization failed.");
 let match=value.match(/^Invalid minimum for (.+)$/);
 if(match)return tr("Invalid minimum for {name}",{name:match[1]});
 match=value.match(/^(.+) cannot reach the required minimum at your current stage\.$/);
 if(match)return tr("{name} cannot reach the required minimum at your current stage.",{name:match[1]});
 match=value.match(/^Internal validation failed: (.+)$/);
 if(match)return tr("Internal validation failed: {detail}",{detail:match[1]});
 return tr(value);
}
const iconMap={"Clan Ship":"⛵","Pet":"🐾","Shadow Clone":"◈","Heavenly Strike":"⚡","Dagger":"🗡","Gold Gun":"✦"};
const branchColors={Knight:"#d77879",Summoner:"#edab66",Warlord:"#e7ca75",Sorcerer:"#86adf7",Rogue:"#7ad0a0",Alchemist:"#b595ed"};
const fresh=()=>({damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,playstyle:"balanced",qol:"recommended",goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,sets:{},currentLevels:{},minimums:{},excluded:[],preserveCurrent:false,assumeHaystActive:false,assumeSnapActive:false,assumeContractsAtMax:false,astralActivations:0,mode:"power"});
let state=fresh(),lastResult=null,worker=null;
// Fixed-position notifications are shared by errors and successful actions.
// Errors stay visible until dismissed; successes auto-dismiss after six seconds.
let toastDismissTimer=null;
function showToast(text,type="error"){
 if(toastDismissTimer!==null){clearTimeout(toastDismissTimer);toastDismissTimer=null;}
 const toast=$("app-toast"),success=type==="success";
 toast.dataset.kind=type;
 toast.setAttribute("role",success?"status":"alert");
 toast.setAttribute("aria-live",success?"polite":"assertive");
 $("toast-title").textContent=tr(success?"Success":"Error");
 $("toast-message").textContent=text;
 toast.querySelector(".toast-symbol").textContent=success?"✓":"!";
 toast.hidden=false;
 if(success)toastDismissTimer=setTimeout(()=>{toastDismissTimer=null;toast.hidden=true;},6000);
}
function hideToast(){
 if(toastDismissTimer!==null){clearTimeout(toastDismissTimer);toastDismissTimer=null;}
 $("app-toast").hidden=true;
}
function status(message,type="",params={}){
 lastStatus={message,type,params};
 const el=$("status");
 const normalized={...params};
 if(normalized.phase)normalized.phase=tr(normalized.phase);
 const translated=tr(message,normalized);
 const display=type==="error"&&translated===message?engineError(message):translated;
 el.textContent=display;
 el.className="status "+type;
 if(type==="error")showToast(display);
 else if(type==="success")showToast(display,"success");
}
function resetOptimizeButton(){const b=$("optimize-button");b.disabled=false;b.innerHTML='<span>✦ &nbsp; '+safe(tr("Optimize my build"))+'</span><span>→</span>';}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function persist(){try{localStorage.setItem("tt2_skill_optimizer_v1",JSON.stringify(state));}catch{}}
function renderChoices(){
  $("damage-choices").innerHTML=DAMAGE_TYPES.map(x=>`<button class="choice ${state.damage===x?"selected":""}" type="button" data-damage="${safe(x)}" aria-pressed="${state.damage===x}"><span>${iconMap[x]}</span>${safe(tr(x))}</button>`).join("");
  $("gold-choices").innerHTML=GOLD_TYPES.map(x=>`<button class="${state.gold===x?"selected":""}" type="button" data-gold="${safe(x)}" aria-pressed="${state.gold===x}">${safe(tr(x==="HoG"?"Heart of Gold":x))}</button>`).join("");
  document.querySelectorAll("[data-playstyle]").forEach(btn=>{const active=btn.dataset.playstyle===state.playstyle;btn.classList.toggle("selected",active);btn.setAttribute("aria-pressed",String(active));});
  $("equipment-choices").innerHTML=Object.entries(SETS).map(([id,label])=>`<label><input type="checkbox" data-set="${id}" ${state.sets?.[id]?"checked":""}><span>${safe(label)}</span></label>`).join("");
}
function renderEditor(filter=""){
 const q=filter.trim().toLowerCase();const matches=SKILL_IDS.filter(id=>SKILLS[id].Name.toLowerCase().includes(q)||BRANCH_NAMES[SKILLS[id].Branch].toLowerCase().includes(q)||tr(BRANCH_NAMES[SKILLS[id].Branch]).toLowerCase().includes(q));
 $("skill-editor").innerHTML='<div class="skill-colhead"><span>'+safe(tr("Skill"))+'</span><span>'+safe(tr("Current"))+'</span><span>'+safe(tr("Minimum"))+'</span><span>'+safe(tr("Exclude"))+'</span></div>'+matches.map(id=>{
  const s=SKILLS[id];return `<div class="skill-row"><span class="skill-name">${safe(s.Name)}<small>${safe(tr(BRANCH_NAMES[s.Branch]))} · max ${s.MaxLevel}</small></span><input type="number" data-level="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.currentLevels?.[id]||0}" aria-label="${safe(tr("Current level for {name}",{name:s.Name}))}"><input type="number" data-minimum="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.minimums?.[id]||0}" aria-label="${safe(tr("Minimum level for {name}",{name:s.Name}))}"><div class="center"><input type="checkbox" data-exclude="${id}" aria-label="${safe(tr("Exclude {name}",{name:s.Name}))}" ${state.excluded?.includes(id)?"checked":""}></div></div>`;
 }).join("");
 if(!matches.length)$("skill-editor").innerHTML="<p class='hint'>"+safe(tr("No skills match your search."))+"</p>";
}
function fillInputs(){
 $("skill-points").value=state.skillPoints||"";
 $("max-stage").value=state.maxStage||"";
 $("gold-weight").value=state.goldWeight;
 $("crafting-power").value=state.craftingPower;
 $("time-to-kill").value=state.timeToKill;
 $("clone-level").value=state.sClone;
 $("qol-mode").value=state.qol;
 $("preserve-current").checked=state.preserveCurrent;
 $("hayst-active").checked=state.assumeHaystActive===true;
 $("snap-active").checked=state.assumeSnapActive===true;
 $("contracts-at-max").checked=state.assumeContractsAtMax===true;
 $("astral-activations").value=state.astralActivations??0;
 renderChoices();renderEditor($("skill-search").value);
}
function remember(){persist();lastResult=null;$("actual-results").hidden=true;$("empty-results").hidden=false;$("result-mode").textContent=tr("Settings changed");}
function applyPreset(id){
 const preset=PRESETS[id];state.playstyle=id;state.goldWeight=preset.goldWeight;state.qol=preset.qol;
 fillInputs();remember();
}
function importRaw(raw){
 const parsed=parseExport(raw);
 state.currentLevels=parsed.levels;
 if(parsed.skillPoints!==null&&parsed.skillPoints>0)state.skillPoints=parsed.skillPoints;
 else if(!state.skillPoints)state.skillPoints=spentPoints(parsed.levels);
 state.maxStage=parsed.maxStage;state.craftingPower=parsed.craftingPower;state.sets=parsed.sets;
 state.sClone=state.sets.tFA?35:30;
 if(parsed.damage)state.damage=parsed.damage;
 if(parsed.gold)state.gold=parsed.gold;
 state.sourceImported=true;
 $("source-label").textContent=tr("Imported from TT2");
 fillInputs();remember();
 status("Account data imported. Review the damage/gold choices and optimize.","success");
}
function offerManualPaste(message,params={},clipboardContent=null){
 const panel=$("paste-details");
 panel.open=true;
 const field=$("import-json");
 // If we could read clipboard but import failed, preserve its text for review.
 if(clipboardContent!==null)field.value=clipboardContent;
 try{field.focus({preventScroll:true});}catch{field.focus();}
 status(message,"error",params);
}
async function pasteClipboard(){
 // The clipboard API may be blocked by browser permissions, insecure origins
 // or embedded browsers. Preserve a manual-paste fallback, rather than saying
 // the user's valid TT2 JSON is malformed.
 const result=await readClipboardText(navigator.clipboard);
 if(!result.ok){
   const reason=result.reason==="empty"
     ?"Clipboard is empty. Copy your TT2 export and try again."
     :result.reason==="unsupported"
     ?"Automatic clipboard access is unavailable. Paste your export into the field below (Ctrl+V on desktop, or Paste on mobile)."
     :"Browser denied clipboard access. Paste your export into the field below (Ctrl+V on desktop, or Paste on mobile).";
   offerManualPaste(reason);
   return;
 }
 try{importRaw(result.text);}
 catch(error){
   offerManualPaste("Clipboard data could not be imported: {detail}",{detail:engineError(error.message)},result.text);
 }
}
async function copyText(value){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch{}}
 const tmp=document.createElement("textarea");tmp.value=value;tmp.style.position="fixed";tmp.style.opacity="0";document.body.appendChild(tmp);tmp.focus();tmp.select();
 let ok=false;try{ok=document.execCommand("copy");}catch{}tmp.remove();return ok;
}
function readInputs(){
 state.skillPoints=Number($("skill-points").value);
 state.maxStage=Number($("max-stage").value)||0;
 state.goldWeight=Number($("gold-weight").value);
 state.craftingPower=Number($("crafting-power").value);
 state.timeToKill=Number($("time-to-kill").value);
 state.sClone=Number($("clone-level").value);
 state.qol=$("qol-mode").value;
 state.preserveCurrent=$("preserve-current").checked;
 state.assumeHaystActive=$("hayst-active").checked;
 state.assumeSnapActive=$("snap-active").checked;
 state.assumeContractsAtMax=$("contracts-at-max").checked;
 state.astralActivations=Number($("astral-activations").value);
 state.mode="power";
 persist();
}
function optimize(){
 const button=$("optimize-button");
 if(worker){
   worker.terminate();worker=null;
   resetOptimizeButton();
   status("Optimization cancelled. Your settings are unchanged.");return;
 }
 readInputs();
 if(!$("skill-points").value){status("Enter your total Skill Points or import a player export.","error");return;}
 button.disabled=false;button.textContent=tr("Cancel optimization");
 status("Checking prerequisites and calculating the best allocation for the chosen scoring model…");
 worker=new Worker(new URL("./worker.js?v=20261116-sp-budget-fix",import.meta.url),{type:"module"});
 worker.onmessage=event=>{
   const data=event.data;
   if(data.progress){
     const phase=data.progress.phase==="skills"?"Building skill-tree options":"Combining skill trees";
     status("{phase}: {completed}/{total} complete. You can cancel at any time.","",{phase,completed:data.progress.completed,total:data.progress.total});
     return;
   }
   resetOptimizeButton();
   if(data.ok){lastResult=data.result;renderResults(data.result);persist();status(data.result.optimality?.mode==="bounded-power"?"Build ready with a certified upper bound on the score gap. See accuracy details below.":"Build optimized. Copy the result to import it into TT2.","success");}
   else{status(data.error||"Optimization failed.","error");$("result-mode").textContent="Could not optimize";}
   worker.terminate();worker=null;
 };
 worker.onerror=event=>{resetOptimizeButton();status("Optimizer worker failed: {detail}","error",{detail:event.message||"unknown error"});worker?.terminate();worker=null;};
 worker.postMessage({type:"optimize",settings:structuredClone(state)});
}
function renderResults(result,scroll=true){
 $("empty-results").hidden=true;$("actual-results").hidden=false;if(scroll)$("results").scrollIntoView({behavior:"smooth",block:"start"});
 const bounded=result.optimality?.mode==="bounded-power";
 $("result-mode").textContent=tr(bounded?"Optimized · bounded grid":"Optimized · exact DP");
 $("build-title").textContent=tr(state.damage)+" · "+tr(state.gold==="HoG"?"Heart of Gold":state.gold);
 $("build-subtitle").textContent=tr(PRESETS[state.playstyle]?.label||"Balanced")+" · "+tr("Weighted log-damage/gold model");
 const assumptions=result.combatAssumptions||{};
 $("combat-assumptions-summary").textContent=tr(
   "Modeled at the limit-stage boss: Hayst {hayst}, Snap {snap}, Astral Awakening {stacks}/5 taps.",
   {hayst:tr(assumptions.hayst?"active":"inactive"),
    snap:tr(assumptions.snap?"active":"inactive"),stacks:assumptions.astralActivations??0})
   +" · "+tr("Contracts at full bonus: {status}",{status:tr(assumptions.contractsAtMax?"yes":"no")});
 const accuracy=document.querySelector(".math-disclaimer");
 if(bounded&&accuracy){
   const o=result.optimality;
   const suffix=tr("Per-branch optimizations are exact. The combined build has a mathematically certified score gap of at most {gap} log10 units (grid step {quantum} SP) relative to the modeled optimum.",{gap:o.gap.toFixed(4),quantum:o.quantum});
   accuracy.textContent=suffix+" "+tr("These bounds describe the weighted damage/gold proxy only, not actual in-game farming performance. Independent community tool.");
 }else if(accuracy){
   accuracy.textContent=tr("Exact optimization for the documented weighted damage/gold score model. Actual game damage, run speed and conditional skill synergies can differ. Independent community tool.");
 }
 $("spent").textContent=numberText(result.spent);
 $("remaining").textContent=numberText(result.remaining);
 $("change-count").textContent=result.changes.length;
 const max=Math.max(1,...Object.values(result.branchTotals));
 $("branch-chart").innerHTML=Object.entries(result.branchTotals).map(([name,points])=>`<div class="branch-row"><div class="branch-header"><span>${safe(tr(name))}</span><strong>${numberText(points)} SP</strong></div><div class="progress-track"><div class="progress-fill" style="width:${points/max*100}%;background:${branchColors[name]}"></div></div></div>`).join("");
 $("full-tree").innerHTML=Object.entries(BRANCH_NAMES).map(([code,name])=>`<h4 class="group-title">${safe(tr(name))}</h4>`+SKILL_IDS.filter(id=>SKILLS[id].Branch===code&&result.levels[id]>0).map(id=>`<div class="tree-row"><span>${safe(SKILLS[id].Name)}</span><strong>${result.levels[id]}</strong></div>`).join("")).join("");
 $("delta-count").textContent="("+result.changes.length+")";
 $("diff-list").innerHTML=result.changes.length?result.changes.map(change=>`<div class="change-row"><span>${safe(change.name)}</span><span><small>${change.before} → ${change.after}</small> <strong class="${change.difference>=0?"plus":"minus"}">${change.difference>0?"+":""}${change.difference}</strong></span></div>`).join(""):"<p class='hint'>"+safe(tr("No skill-level changes."))+"</p>";
 $("export-json").value=exportBuild(result.levels);
}
function sharePayload(){
 // Compact URL encoding; the exported skill tree itself is intentionally
 // not encrypted. Sharing the link discloses the included game settings.
 return {sp:state.skillPoints,st:state.maxStage,da:state.damage,go:state.gold,p:state.playstyle,q:state.qol,w:state.goldWeight,cp:state.craftingPower,tk:state.timeToKill,cl:state.sClone,s:state.sets,cur:state.currentLevels,min:state.minimums,exc:state.excluded,keep:state.preserveCurrent,hay:state.assumeHaystActive,snap:state.assumeSnapActive,contracts:state.assumeContractsAtMax,astral:state.astralActivations};
}
function decodeLink(){
 const hash=window.location.hash;
 if(!hash.startsWith("#build="))return;
 try{
  const payload=JSON.parse(decodeURIComponent(escape(atob(hash.slice(7)))));
  if(!payload||typeof payload!=="object")return;
  state={...fresh(),skillPoints:payload.sp??0,maxStage:payload.st??0,damage:payload.da??"Clan Ship",gold:payload.go??"Fairy",playstyle:payload.p??"balanced",qol:payload.q??"recommended",goldWeight:payload.w??.7,craftingPower:payload.cp??1,timeToKill:payload.tk??8,sClone:payload.cl??30,sets:payload.s||{},currentLevels:payload.cur||{},minimums:payload.min||{},excluded:Array.isArray(payload.exc)?payload.exc:[],preserveCurrent:Boolean(payload.keep),assumeHaystActive:payload.hay===true,
    assumeSnapActive:payload.snap===true,assumeContractsAtMax:payload.contracts===true,astralActivations:payload.astral??0,mode:"power"};
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  status("Shared build settings loaded. Optimize to calculate a new recommendation.","success");
 }catch(e){status("Could not load this shared build link.","error");}
}
function initialize(){
 try{const saved=JSON.parse(localStorage.getItem("tt2_skill_optimizer_v1")||"null");if(saved&&typeof saved==="object")state={...fresh(),...saved};}catch{}
 decodeLink();state.mode="power";fillInputs();
 const queryLang=new URL(location.href).searchParams.get("lang");
 const pathLang=document.documentElement.lang;
 let savedLang="en";try{savedLang=localStorage.getItem("tt2_site_language")||"en"}catch{}
 const desired=SUPPORTED_LANGUAGES.includes(queryLang)?queryLang:(pathLang==="en"&&SUPPORTED_LANGUAGES.includes(savedLang)?savedLang:pathLang);
 if(desired!==pathLang || queryLang){
   location.replace(localizedUrl(desired)); return;
 }
 setLocale(pathLang);
 $("language-select").addEventListener("change",e=>changeLanguage(e.target.value));
 $("toast-close").addEventListener("click",hideToast);
 const help=$("export-help-dialog");
 $("export-help-button").addEventListener("click",()=>help.showModal());
 for(const id of ["export-help-close","export-help-done"])$(id).addEventListener("click",()=>help.close());
 const importHelp=$("import-help-dialog");
 $("import-help-button").addEventListener("click",()=>importHelp.showModal());
 for(const id of ["import-help-close","import-help-done"])$(id).addEventListener("click",()=>importHelp.close());
 $("damage-choices").addEventListener("click",e=>{const b=e.target.closest("[data-damage]");if(b){state.damage=b.dataset.damage;fillInputs();remember();}});
 $("gold-choices").addEventListener("click",e=>{const b=e.target.closest("[data-gold]");if(b){state.gold=b.dataset.gold;fillInputs();remember();}});
 $("playstyle-choices").addEventListener("click",e=>{const b=e.target.closest("[data-playstyle]");if(b)applyPreset(b.dataset.playstyle);});
 $("equipment-choices").addEventListener("change",e=>{const id=e.target.dataset.set;if(id){state.sets[id]=e.target.checked;remember();}});
 $("skill-search").addEventListener("input",e=>renderEditor(e.target.value));
 $("skill-editor").addEventListener("change",e=>{
  const t=e.target,id=t.dataset.level||t.dataset.minimum||t.dataset.exclude;
  if(!id)return;
  if(t.dataset.level)state.currentLevels[id]=Number(t.value);
  if(t.dataset.minimum)state.minimums[id]=Number(t.value);
  if(t.dataset.exclude)state.excluded=t.checked?[...new Set([...state.excluded,id])]:state.excluded.filter(x=>x!==id);
  remember();
 });
 $("clear-minimums").addEventListener("click",()=>{state.minimums={};fillInputs();remember();});
 for(const id of ["skill-points","max-stage","gold-weight","crafting-power","time-to-kill","clone-level","qol-mode","preserve-current","hayst-active","snap-active","contracts-at-max","astral-activations"])$(id).addEventListener("change",()=>{readInputs();remember();});
 $("paste-button").addEventListener("click",pasteClipboard);
 $("upload-button").addEventListener("click",()=>$("upload-file").click());
 $("upload-file").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error(tr("File exceeds 2 MB."));importRaw(await f.text());}catch(err){status(err.message,"error");}e.target.value="";});
 $("import-button").addEventListener("click",()=>{try{importRaw($("import-json").value);}catch(e){status(e.message,"error");}});
 $("optimize-button").addEventListener("click",optimize);
 $("copy-build").addEventListener("click",async()=>{
  if(!lastResult)return;
  const copied=await copyText(exportBuild(lastResult.levels));
  status(copied?"Build JSON copied. Paste it into your TT2 skill-tree importer.":"Please select and copy the JSON from the Exported JSON panel.",copied?"success":"error");
 });
 $("share-build").addEventListener("click",async()=>{
  const json=JSON.stringify(sharePayload());
  const link=window.location.href.split("#")[0]+"#build="+btoa(unescape(encodeURIComponent(json)));
  const copied=await copyText(link);
  status(copied?"Shareable link copied. Note: it contains the TT2 settings you entered.":"Copy failed. Check browser clipboard permissions.",copied?"success":"error");
 });
}
initialize();
