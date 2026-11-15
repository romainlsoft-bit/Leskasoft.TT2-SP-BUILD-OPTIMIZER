import {SKILLS,SKILL_IDS,BRANCH_NAMES,SETS,PRESETS,DAMAGE_TYPES,GOLD_TYPES,GAME_VERSION,parseExport,exportBuild,spentPoints} from "./engine.js";
const $=id=>document.getElementById(id);
const iconMap={"Clan Ship":"⛵","Pet":"🐾","Shadow Clone":"◈","Heavenly Strike":"⚡","Dagger":"🗡","Gold Gun":"✦"};
const branchColors={Knight:"#d77879",Summoner:"#edab66",Warlord:"#e7ca75",Sorcerer:"#86adf7",Rogue:"#7ad0a0",Alchemist:"#b595ed"};
const fresh=()=>({damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,playstyle:"balanced",qol:"recommended",goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,sets:{},currentLevels:{},minimums:{},excluded:[],preserveCurrent:false,mode:"power"});
let state=fresh(),lastResult=null,worker=null;
function status(message,type=""){const el=$("status");el.textContent=message;el.className="status "+type;}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function persist(){try{localStorage.setItem("tt2_skill_optimizer_v1",JSON.stringify(state));}catch{}}
function renderChoices(){
  $("damage-choices").innerHTML=DAMAGE_TYPES.map(x=>`<button class="choice ${state.damage===x?"selected":""}" type="button" data-damage="${safe(x)}" aria-pressed="${state.damage===x}"><span>${iconMap[x]}</span>${safe(x)}</button>`).join("");
  $("gold-choices").innerHTML=GOLD_TYPES.map(x=>`<button class="${state.gold===x?"selected":""}" type="button" data-gold="${safe(x)}" aria-pressed="${state.gold===x}">${x==="HoG"?"Heart of Gold":safe(x)}</button>`).join("");
  document.querySelectorAll("[data-playstyle]").forEach(btn=>{const active=btn.dataset.playstyle===state.playstyle;btn.classList.toggle("selected",active);btn.setAttribute("aria-pressed",String(active));});
  $("equipment-choices").innerHTML=Object.entries(SETS).map(([id,label])=>`<label><input type="checkbox" data-set="${id}" ${state.sets?.[id]?"checked":""}><span>${safe(label)}</span></label>`).join("");
}
function renderEditor(filter=""){
 const q=filter.trim().toLowerCase();const matches=SKILL_IDS.filter(id=>SKILLS[id].Name.toLowerCase().includes(q)||BRANCH_NAMES[SKILLS[id].Branch].toLowerCase().includes(q));
 $("skill-editor").innerHTML='<div class="skill-colhead"><span>Skill</span><span>Current</span><span>Minimum</span><span>Exclude</span></div>'+matches.map(id=>{
  const s=SKILLS[id];return `<div class="skill-row"><span class="skill-name">${safe(s.Name)}<small>${safe(BRANCH_NAMES[s.Branch])} · max ${s.MaxLevel}</small></span><input type="number" data-level="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.currentLevels?.[id]||0}" aria-label="Current level for ${safe(s.Name)}"><input type="number" data-minimum="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.minimums?.[id]||0}" aria-label="Minimum level for ${safe(s.Name)}"><div class="center"><input type="checkbox" data-exclude="${id}" aria-label="Exclude ${safe(s.Name)}" ${state.excluded?.includes(id)?"checked":""}></div></div>`;
 }).join("");
 if(!matches.length)$("skill-editor").innerHTML="<p class='hint'>No skills match your search.</p>";
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
 $("efficiency-mode").checked=state.mode==="efficiency";
 renderChoices();renderEditor($("skill-search").value);
}
function remember(){persist();lastResult=null;$("actual-results").hidden=true;$("empty-results").hidden=false;$("result-mode").textContent="Settings changed";}
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
 $("source-label").textContent="Imported from TT2";
 fillInputs();remember();
 status("Account data imported. Review the damage/gold choices and optimize.","success");
}
async function pasteClipboard(){
 try{const raw=await navigator.clipboard.readText();importRaw(raw);}
 catch(e){$("paste-details").open=true;status("Clipboard unavailable or invalid export. Paste the JSON in the box instead: "+e.message,"error");}
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
 state.mode=$("efficiency-mode").checked?"efficiency":"power";
 persist();
}
function optimize(){
 readInputs();
 if(!$("skill-points").value){status("Enter your total Skill Points or import a player export.","error");return;}
 if(worker)worker.terminate();
 const button=$("optimize-button");button.disabled=true;button.textContent="Optimizing in your browser…";
 status("Checking prerequisites and calculating the best allocation for the chosen scoring model…");
 worker=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});
 worker.onmessage=event=>{
   button.disabled=false;button.innerHTML="<span>✦ &nbsp; Optimize my build</span><span>→</span>";
   const data=event.data;
   if(data.ok){lastResult=data.result;renderResults(data.result);persist();status("Build optimized. Copy the result to import it into TT2.","success");}
   else{status(data.error||"Optimization failed.","error");$("result-mode").textContent="Could not optimize";}
   worker.terminate();worker=null;
 };
 worker.onerror=event=>{button.disabled=false;button.innerHTML="<span>✦ &nbsp; Optimize my build</span><span>→</span>";status("Optimizer worker failed: "+(event.message||"unknown error"),"error");worker?.terminate();worker=null;};
 worker.postMessage({type:"optimize",settings:structuredClone(state)});
}
function renderResults(result){
 $("empty-results").hidden=true;$("actual-results").hidden=false;$("results").scrollIntoView({behavior:"smooth",block:"start"});
 $("result-mode").textContent="Optimized · exact DP";
 $("build-title").textContent=state.damage+" · "+(state.gold==="HoG"?"Heart of Gold":state.gold)+" Gold";
 $("build-subtitle").textContent=PRESETS[state.playstyle]?.label+" · Weighted log-damage/gold model";
 $("spent").textContent=result.spent.toLocaleString("en-US");
 $("remaining").textContent=result.remaining.toLocaleString("en-US");
 $("change-count").textContent=result.changes.length;
 const max=Math.max(1,...Object.values(result.branchTotals));
 $("branch-chart").innerHTML=Object.entries(result.branchTotals).map(([name,points])=>`<div class="branch-row"><div class="branch-header"><span>${safe(name)}</span><strong>${points.toLocaleString("en-US")} SP</strong></div><div class="progress-track"><div class="progress-fill" style="width:${points/max*100}%;background:${branchColors[name]}"></div></div></div>`).join("");
 $("full-tree").innerHTML=Object.entries(BRANCH_NAMES).map(([code,name])=>`<h4 class="group-title">${safe(name)}</h4>`+SKILL_IDS.filter(id=>SKILLS[id].Branch===code&&result.levels[id]>0).map(id=>`<div class="tree-row"><span>${safe(SKILLS[id].Name)}</span><strong>${result.levels[id]}</strong></div>`).join("")).join("");
 $("delta-count").textContent="("+result.changes.length+")";
 $("diff-list").innerHTML=result.changes.length?result.changes.map(change=>`<div class="change-row"><span>${safe(change.name)}</span><span><small>${change.before} → ${change.after}</small> <strong class="${change.difference>=0?"plus":"minus"}">${change.difference>0?"+":""}${change.difference}</strong></span></div>`).join(""):"<p class='hint'>No skill-level changes.</p>";
 $("export-json").value=exportBuild(result.levels);
}
function sharePayload(){
 // Compact URL encoding; the exported skill tree itself is intentionally
 // not encrypted. Sharing the link discloses the included game settings.
 return {sp:state.skillPoints,st:state.maxStage,da:state.damage,go:state.gold,p:state.playstyle,q:state.qol,w:state.goldWeight,cp:state.craftingPower,tk:state.timeToKill,cl:state.sClone,s:state.sets,cur:state.currentLevels,min:state.minimums,exc:state.excluded,keep:state.preserveCurrent,mode:state.mode};
}
function decodeLink(){
 const hash=window.location.hash;
 if(!hash.startsWith("#build="))return;
 try{
  const payload=JSON.parse(decodeURIComponent(escape(atob(hash.slice(7)))));
  if(!payload||typeof payload!=="object")return;
  state={...fresh(),skillPoints:payload.sp??0,maxStage:payload.st??0,damage:payload.da??"Clan Ship",gold:payload.go??"Fairy",playstyle:payload.p??"balanced",qol:payload.q??"recommended",goldWeight:payload.w??.7,craftingPower:payload.cp??1,timeToKill:payload.tk??8,sClone:payload.cl??30,sets:payload.s||{},currentLevels:payload.cur||{},minimums:payload.min||{},excluded:Array.isArray(payload.exc)?payload.exc:[],preserveCurrent:Boolean(payload.keep),mode:payload.mode||"power"};
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  status("Shared build settings loaded. Optimize to calculate a new recommendation.","success");
 }catch(e){status("Could not load this shared build link.","error");}
}
function initialize(){
 try{const saved=JSON.parse(localStorage.getItem("tt2_skill_optimizer_v1")||"null");if(saved&&typeof saved==="object")state={...fresh(),...saved};}catch{}
 decodeLink();fillInputs();
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
 for(const id of ["skill-points","max-stage","gold-weight","crafting-power","time-to-kill","clone-level","qol-mode","preserve-current","efficiency-mode"])$(id).addEventListener("change",()=>{readInputs();remember();});
 $("paste-button").addEventListener("click",pasteClipboard);
 $("upload-button").addEventListener("click",()=>$("upload-file").click());
 $("upload-file").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error("File exceeds 2 MB.");importRaw(await f.text());}catch(err){status(err.message,"error");}e.target.value="";});
 $("import-button").addEventListener("click",()=>{try{importRaw($("import-json").value);}catch(e){status(e.message,"error");}});
 $("optimize-button").addEventListener("click",optimize);
 $("copy-build").addEventListener("click",async()=>{if(!lastResult)return;status(await copyText(exportBuild(lastResult.levels))?"Build JSON copied. Paste it into your TT2 skill-tree importer.":"Please select and copy the JSON from the Exported JSON panel.","success");});
 $("share-build").addEventListener("click",async()=>{const json=JSON.stringify(sharePayload());const link=window.location.href.split("#")[0]+"#build="+btoa(unescape(encodeURIComponent(json)));status(await copyText(link)?"Shareable link copied. Note: it contains the TT2 settings you entered.":"Copy failed. Check browser clipboard permissions.","success");});
}
initialize();
