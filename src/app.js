import {createAccountDiagnosticsRenderer} from "./account-diagnostics-ui.js?v=20261123-boss-specials-r1&refactor=20261126-audit56-ui-r1";
import {createResultDetailRenderers} from "./result-details-ui.js?v=20261123-boss-specials-r1&refactor=20261126-audit56-ui-r1";
import {gameVersionEvidence} from "./game-version-policy.js?v=20261123-boss-specials-r1";
import {VERIFIED_NEXT_SEASON_START_UTC} from "./current-season-policy.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {restoreSavedBuild,persistSavedBuild,eraseSavedBrowserData,storeLanguage} from "./browser-persistence.js?v=20261123-boss-specials-r1&storage=20261126-audit56-r1";
import {createShareableBuildLink,readSharedBuild} from "./share-link-protocol.js?v=20261123-boss-specials-r1&storage=20261126-audit56-r1";
import {publicOptimizationSettings} from "./public-optimization-policy.js?v=20261123-boss-specials-r1&poisonsprout=20261127-r1&specialspells=20261127-r1&warlordboss=20261127-r1";
import {SKILLS,SKILL_IDS,BRANCH_NAMES,PRESETS,DAMAGE_TYPES,GOLD_TYPES,parseExport,exportBuild,ownedSetFlags,capCurrentMaxStage,CURRENT_MAIN_GAME_STAGE_CAP} from "./engine.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&compat=20261126-audit56-r1&score=20261123-cadence-separated-r1&audit=20261123-ti-sensitivity-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1&ideal=20261126-boss-r1&architecture=20261127-audit56-r1&pairrefine=20261127-r1&spellconstraints=20261127-r1&dimensional=20261127-r1&warmstart=20261127-r1&poisonsprout=20261127-r1&specialspells=20261127-r1&warlordboss=20261127-r1";
import { t, localizeDocument, SUPPORTED_LANGUAGES, loadLocale } from "./i18n.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&ui=20261123-hide-observed-hit-r1&audit=20261123-ti-sensitivity-r1&alt=20261123-ti-second-tree-r1&ideal=20261126-boss-r1&security=20261126-audit56-r1&compat=20261126-audit56-r1&locale=20261127-audit56-r1&poisonsprout=20261127-r1&specialspells=20261127-r1&warlordboss=20261127-r1";
import { readClipboardText } from "./clipboard.js?v=20261123-boss-specials-r1";
import {resetAccountDependentOptions} from "./import-session-reset.js?v=20261123-boss-specials-r1&ideal=20261126-boss-r1";
import { profileCoverage } from "./account-profile.js?v=20261123-boss-specials-r1";
import {petLevelEvidence} from "./account-pet-levels.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261123-boss-specials-r1";
import {formatLogMultiplier} from "./account-power.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {availablePets} from "./pet-scenarios.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {bestEquipmentByCategory,EQUIPMENT_CATEGORIES} from "./equipment-scenarios.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&security=20261126-audit56-r1&gearct=20261127-r1&gearfactor=20261127-r1";
const $=id=>document.getElementById(id);
let locale="en";
let lastStatus={message:"Import your account or enter your skill points to begin.",type:"",params:{}};
const tr=(message,params={})=>t(message,locale,params);
const numberText=value=>Number(value).toLocaleString({en:"en-US",fr:"fr-FR",uk:"uk-UA",ru:"ru-RU"}[locale]);
function setLocale(next){
 locale=SUPPORTED_LANGUAGES.includes(next)?next:"en";
 try{storeLanguage(localStorage,locale)}catch{}
 $("language-select").value=locale;
 localizeDocument(document,locale);
 // Main Leskasoft site uses the same four locale codes as this optimizer.
 const leskasoft=$("leskasoft-link");
 if(leskasoft)leskasoft.href="https://www.leskasoft.fr/"+locale;
 renderChoices();renderEditor($("skill-search").value);
 $("source-label").textContent=tr(state.sourceImported?"Imported from TT2":"Manual setup");
 renderAccountProfile();renderPetControls();
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
 try{storeLanguage(localStorage,lang)}catch{}
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
const fresh=()=>({damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,stageSeason:null,playstyle:"balanced",qol:"recommended",goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,sets:{},currentLevels:{},minimums:{},excluded:[],preserveCurrent:false,assumeCoordinatedOffensiveActive:true,assumeFlashZipAtBoss:true,assumeNightmareAtBoss:true,assumeMagnumOpusAtBoss:true,assumeHaystActive:true,assumeSnapActive:true,assumeContractsAtMax:false,astralActivations:5,mode:"power",accountProfile:null,selectedDamagePet:null,selectedGoldPet:null,comparePetScenarios:false,selectedEquipment:{},protectUnmodeledSkills:true,excludeUnverifiedTacticalInsight:false,tacticalInsightCalibration:null,contractTimeline:null,contractMultiScenario:null,
 importedVersion:null,budgetSource:"unset",budgetInconsistent:false,
 pushAttackChannelId:"",pushSourceStageSkipTarget:0,
 pushFrontierEnabled:false,attackDamageFrontierEnabled:false,attackDamageChannelId:""});
let manualCurrentStageConfirmed=false;
let state=publicOptimizationSettings(fresh()),lastResult=null,lastEquipment={},
 lastGearSelection=null,lastResolvedPets=null,lastRunContext=null,
 worker=null,calculationRevision=0;
// Public recommendations must ignore obsolete speculative contract settings.
function keepContractsConservative(options){
 options.assumeContractsAtMax=false;
 options.contractTimeline=null;
 options.contractMultiScenario=null;
 options.allowContractScenarioReallocation=false;
 return options;
}
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
function persist(){
 try{persistSavedBuild(localStorage,state);}catch{}
}
function renderChoices(){
  $("damage-choices").innerHTML=DAMAGE_TYPES.map(x=>`<button class="choice ${state.damage===x?"selected":""}" type="button" data-damage="${safe(x)}" aria-pressed="${state.damage===x}"><span>${iconMap[x]}</span>${safe(tr(x))}</button>`).join("");
  $("gold-choices").innerHTML=GOLD_TYPES.map(x=>`<button class="${state.gold===x?"selected":""}" type="button" data-gold="${safe(x)}" aria-pressed="${state.gold===x}">${safe(tr(x==="HoG"?"Heart of Gold":x))}</button>`).join("");
  document.querySelectorAll("[data-playstyle]").forEach(btn=>{const active=btn.dataset.playstyle===state.playstyle;btn.classList.toggle("selected",active);btn.setAttribute("aria-pressed",String(active));});
}
function renderEditor(filter=""){
 const q=filter.trim().toLowerCase();const matches=SKILL_IDS.filter(id=>SKILLS[id].Name.toLowerCase().includes(q)||BRANCH_NAMES[SKILLS[id].Branch].toLowerCase().includes(q)||tr(BRANCH_NAMES[SKILLS[id].Branch]).toLowerCase().includes(q));
 $("skill-editor").innerHTML='<div class="skill-colhead"><span>'+safe(tr("Skill"))+'</span><span>'+safe(tr("Current"))+'</span><span>'+safe(tr("Minimum"))+'</span><span>'+safe(tr("Exclude"))+'</span></div>'+matches.map(id=>{
  const s=SKILLS[id];return `<div class="skill-row"><span class="skill-name">${safe(s.Name)}<small>${safe(tr(BRANCH_NAMES[s.Branch]))} · max ${s.MaxLevel}</small></span><input type="number" data-level="${id}" min="0" max="${s.MaxLevel}" step="1" value="${safe(state.currentLevels?.[id]??0)}" aria-label="${safe(tr("Current level for {name}",{name:s.Name}))}"><input type="number" data-minimum="${id}" min="0" max="${s.MaxLevel}" step="1" value="${safe(state.minimums?.[id]??0)}" aria-label="${safe(tr("Minimum level for {name}",{name:s.Name}))}"><div class="center"><input type="checkbox" data-exclude="${id}" aria-label="${safe(tr("Exclude {name}",{name:s.Name}))}" ${state.excluded?.includes(id)?"checked":""}></div></div>`;
 }).join("");
 if(!matches.length)$("skill-editor").innerHTML="<p class='hint'>"+safe(tr("No skills match your search."))+"</p>";
}
const SEASON14_NOTICE="Transcendence season 14 began 26 November 2026. The ten eligible Transcendent pets and the 52 monument records use the season-14 game-data variant; only owned pets and monuments from a season-14 account export contribute. Stage 180,000 is the Transcendence entry threshold, not a seasonal maximum. Some conditional effects remain unmodeled.";
function renderAccountProfile(){
 let el=$("account-profile-summary");
 if(!el){
  const box=document.querySelector(".import-box");
  if(!box)return;
  el=document.createElement("p");
  el.id="account-profile-summary";
  el.className="hint";
  el.setAttribute("role","status");
  box.appendChild(el);
 }
 const profile=state.accountProfile;
 if(!profile){el.hidden=true;return;}
 const labels={
  artifacts:"Artifacts",gemstones:"Mystic Gemstones",mysticResearch:"Mystic Research",
  clanTechnology:"Clan Technology",
  titanCards:"Titan cards",forbiddenResearch:"Forbidden Research",titanResearch:"Titan Research",
  petLevels:"Pets",passiveSkills:"Passive skills",monuments:"Monuments",
  seasonArtifacts:"Seasonal artifacts",heroWeapons:"Hero weapons",clanScrolls:"Clan Scrolls",
  uniqueEquipment:"Owned unique equipment",equipmentSets:"Owned equipment sets",
  equipmentHistory:"Equipment acquisition history",
  equippedGear:"Equipped gear",equipmentInventory:"Equipment inventory"
 };
 const found=profileCoverage(profile);
 const names=found.map(item=>tr(labels[item.key])+": "+numberText(item.count));
 el.textContent=names.length
  ?tr("Detected account categories: {categories}. Some effects are modeled; other imported categories remain diagnostic.",{categories:names.join(" · ")})
  :tr("Skill-tree-only export: no additional account categories detected.");
 if(String(profile?.stats?.transcendenceSeason||"")==="14")
  el.textContent+=" "+tr(SEASON14_NOTICE);
 const versionReport=gameVersionEvidence(state.importedVersion);
 if(versionReport.status==="newer-than-verified")
  el.textContent+=" "+tr(
   "Imported TT2 version {version} is newer than the verified skill catalog {catalog}. Compatibility with newer gameplay mechanics is not fully validated.",
   {version:versionReport.exportedVersion,catalog:versionReport.verifiedSkillCatalogVersion});
 else if(versionReport.status==="older-than-verified"||
         versionReport.status==="unrecognized")
  el.textContent+=" "+tr(
   "Imported TT2 version {version} is not validated against skill catalog {catalog}. Check your imported skills before applying the build.",
   {version:versionReport.exportedVersion,catalog:versionReport.verifiedSkillCatalogVersion});
 const petData=petLevelEvidence(profile);
 if(petData.rejected.length){
  el.textContent+=" "+tr("Pet import warning: {count} invalid, conflicting or unknown pet records were excluded from calculations.",{count:numberText(petData.rejected.length)});
 }
 const gems=resolveGemstoneEvidence(profile);
 if(gems.present){
  el.textContent+=" "+tr("Gemstone effects: {direct} direct, {equipment} equipment and {pets} pet-amplifier bonuses recognized; {unresolved} unresolved. Research-granted levels are not multiplied again into exported effects.",{
   direct:numberText(gems.directEffects),equipment:numberText(gems.equipmentEffects),pets:numberText(gems.petEffects),
   unresolved:numberText(gems.unknown.length)});
 }
 el.dataset.incomplete=String(petData.rejected.length>0||gems.unknown.length>0);
 el.hidden=false;
}
function renderPetControls(){
 let box=$("pet-setup");
 if(!box){
  box=document.createElement("div");box.id="pet-setup";box.className="import-box";
  const importer=document.querySelector(".setup .import-box");
  if(!importer)return;
  importer.insertAdjacentElement("afterend",box);
  box.addEventListener("change",event=>{
   const target=event.target,id=target.id;
   if(id==="pet-damage-select")state.selectedDamagePet=target.value||null;
   else if(id==="pet-gold-select")state.selectedGoldPet=target.value||null;
   else if(target.dataset.gearSlot){
    state.selectedEquipment={...state.selectedEquipment,
     [target.dataset.gearSlot]:target.value||null};
   }else return;
   remember();
  });
 }
 const pets=availablePets(state.accountProfile);
 const shortlisted=bestEquipmentByCategory(state.accountProfile,state,2);
 const hasGear=EQUIPMENT_CATEGORIES.some(slot=>(shortlisted[slot]||[]).length>0);
 if(!pets.length&&!hasGear){box.hidden=true;return;}
 box.hidden=false;
 let html='<h3>'+safe(tr("Pets and equipment"))+'</h3>';
 if(pets.length){
  const renderOptions=(slot,selected)=>{
   const options=pets.filter(p=>p.equipType===(slot==="damage"?"Damage":"Support"));
   return '<option value="">'+safe(tr("Automatic"))+'</option>'+options.map(p=>
    '<option value="'+safe(p.id)+'" '+(selected===p.id?"selected":"")+'>'+
    safe(p.name)+' · '+safe(tr(p.tier))+' · '+safe(p.type)+' · '+numberText(p.level)+' '+safe(tr("levels"))+'</option>').join("");
  };
  html+='<p class="hint">'+safe(tr("Automatic pet slots use one source-ranked owned pet each; manually selected pets stay fixed."))+'</p>'
   +'<div class="field-grid"><label>'+safe(tr("Damage pet"))+'<select id="pet-damage-select">'+renderOptions("damage",state.selectedDamagePet)+'</select></label>'
   +'<label>'+safe(tr("Gold pet"))+'<select id="pet-gold-select">'+renderOptions("gold",state.selectedGoldPet)+'</select></label></div>';
 }
 if(hasGear){
  html+='<h3>'+safe(tr("Equipment candidates"))+'</h3>'
   +'<p class="hint">'+safe(tr("The two strongest known candidates per equipment slot are shown. Unknown effects remain unscored."))+'</p>'
   +'<div class="field-grid">';
  for(const slot of EQUIPMENT_CATEGORIES){
   const options=shortlisted[slot]||[];
   if(!options.length)continue;
   const active=state.selectedEquipment?.[slot]||"";
   html+='<label>'+safe(tr(slot))+'<select data-gear-slot="'+slot+'">'
    +'<option value="">'+safe(tr("Automatic"))+'</option>'
    +options.map(item=>'<option value="'+safe(item.uid)+'" '+(active===item.uid?"selected":"")+'>'+
      safe(item.displayName)+ (item.estimatedScore===null?' · ?':' · '+item.estimatedScore.toFixed(2)+' log10')+'</option>').join("")
    +'</select></label>';
  }
  html+='</div>';
  if(shortlisted.helmetRotation){
   const h=shortlisted.helmetRotation;
   const names=[...h.unique,...h.ranged,...h.spell,...h.melee].map(x=>x.displayName);
   if(names.length)html+='<p class="hint">'+safe(tr("Helmet alternatives/rotation: {names}",{names:names.join(" · ")}))+'</p>';
  }
  html+='<p class="hint">'+safe(tr("Gunblade helmets are required for Dagger, Heavenly Strike, Gold Gun and Shadow Clone. Other builds can use Elder Snow Cap or rotate hero-type helmets."))+'</p>';
 }
 html+='<p class="hint">'+safe(tr("Automatic damage and gold source selection will require calibrated cross-build scoring; it is not yet safe to rank those builds together."))+'</p>';
 box.innerHTML=html;
}
function renderEquipmentRecommendations(){
 let el=$("equipment-comparison-results");
 if(!el){
  el=document.createElement("div");el.id="equipment-comparison-results";
  el.className="result-detail";
  $("branch-chart").insertAdjacentElement("afterend",el);
 }
 const selected=lastGearSelection?.selected||{};
 const hasWinner=Object.keys(selected).length>0;
 const available=EQUIPMENT_CATEGORIES.filter(slot=>(lastEquipment[slot]||[]).length>0);
 if(!available.length&&!hasWinner){el.hidden=true;return;}
 el.hidden=false;
 const pets=lastResolvedPets;
 const petName=id=>availablePets(state.accountProfile).find(p=>p.id===id)?.name||id||"—";
 const heading='<h3>'+safe(tr("Selected optimized equipment"))+'</h3>';
 const petLine=pets?'<p><strong>'+safe(tr("Damage pet"))+':</strong> '+
  safe(petName(pets.damage))+' · <strong>'+safe(tr("Gold pet"))+
  ':</strong> '+safe(petName(pets.gold))+'</p>':"";
 const winner=EQUIPMENT_CATEGORIES.map(slot=>{
  const row=selected[slot];
  return '<p><strong>'+safe(tr(slot))+':</strong> '+
   safe(row?.name||"—")+
   (row?.linkedPrimaryTarget?' · '+safe(row.linkedPrimaryTarget):"")+'</p>';
 }).join("");
 const alternatives=available.length?
  '<h4>'+safe(tr("Equipment alternatives"))+'</h4>'+
  available.map(slot=>'<p><strong>'+safe(tr(slot))+':</strong> '+
   lastEquipment[slot].map(item=>safe(item.displayName)+
    (item.estimatedScore===null?' (?)':'')).join(' · ')+'</p>').join(""):"";
 el.innerHTML=heading+petLine+winner+alternatives;
}

function fillInputs(){
 renderAccountProfile();renderPetControls();
 $("skill-points").value=state.skillPoints??"";
 state.maxStage=capCurrentMaxStage(
  state.maxStage,state.accountProfile,manualCurrentStageConfirmed);
 const season=Number(state.accountProfile?.stats?.transcendenceSeason);
 const season14Started=Date.now()>=Date.parse(VERIFIED_NEXT_SEASON_START_UTC);
 if(season14Started&&(!state.accountProfile||season===14))
  $("max-stage").removeAttribute("max");
 else $("max-stage").max=CURRENT_MAIN_GAME_STAGE_CAP;
 $("max-stage").value=state.maxStage||"";
 $("gold-weight").value=state.goldWeight;
 $("crafting-power").value=state.craftingPower;
 $("time-to-kill").value=state.timeToKill;
 $("clone-level").value=state.sClone;
 $("qol-mode").value=state.qol;
 $("preserve-current").checked=state.preserveCurrent;
 $("protect-unmodeled-skills").checked=state.protectUnmodeledSkills!==false;
 renderChoices();renderEditor($("skill-search").value);
}
function remember(){
 calculationRevision++;
 if(worker){worker.terminate();worker=null;resetOptimizeButton();}
 persist();lastEquipment={};lastGearSelection=null;
 lastResolvedPets=null;lastRunContext=null;lastResult=null;
 $("actual-results").hidden=true;$("empty-results").hidden=false;
 $("result-mode").textContent=tr("Settings changed");
}
function applyPreset(id){
 const preset=PRESETS[id];state.playstyle=id;state.goldWeight=preset.goldWeight;state.qol=preset.qol;
 fillInputs();remember();
}
function importRaw(raw){
 const parsed=parseExport(raw);
 resetAccountDependentOptions(state);
 state.currentLevels=parsed.levels;
 state.importedVersion=parsed.importedVersion;
 state.skillPoints=parsed.skillPoints??parsed.skillPointsSpent;
 state.budgetSource=parsed.budgetSource;
 state.budgetInconsistent=parsed.budgetInconsistent;
 manualCurrentStageConfirmed=false;
 state.stageSeason=null;
 state.maxStage=parsed.maxStage;state.craftingPower=parsed.craftingPower;state.sets=parsed.sets;
 state.accountProfile=parsed.profile;

 state.sClone=state.sets.tFA?35:30;
 if(parsed.damage)state.damage=parsed.damage;
 if(parsed.gold)state.gold=parsed.gold;
 state.sourceImported=true;
 $("source-label").textContent=tr("Imported from TT2");
 fillInputs();remember();
 $("import-json").value=""; // Do not retain the raw full-account export in the DOM.
 if(parsed.budgetInconsistent)
  status("Imported Skill Points are lower than the cost of the imported skill tree. Correct the budget before optimizing.","error");
 else if(parsed.budgetSource==="inferred")
  status("No SP budget in the export: initialized from the imported skill tree cost. You can adjust it.");
 else status("Account data imported. Review the damage/gold choices and optimize.","success");
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
 const manuallyEntered=Number($("skill-points").value);
 if(manuallyEntered!==state.skillPoints){
  state.budgetSource="manual";state.budgetInconsistent=false;
 }
 state.skillPoints=manuallyEntered;
 manualCurrentStageConfirmed=true;
 state.stageSeason=!state.accountProfile&&Date.now()>=Date.parse(VERIFIED_NEXT_SEASON_START_UTC)?14:null;
 state.maxStage=capCurrentMaxStage(
  $("max-stage").value,state.accountProfile,true);
 state.goldWeight=Number($("gold-weight").value);
 state.craftingPower=Number($("crafting-power").value);
 state.timeToKill=Number($("time-to-kill").value);
 state.sClone=Number($("clone-level").value);
 state.qol=$("qol-mode").value;
 state.preserveCurrent=$("preserve-current").checked;
 state.protectUnmodeledSkills=$("protect-unmodeled-skills").checked;
 Object.assign(state,publicOptimizationSettings(state));
 keepContractsConservative(state);
 state.mode="power";
 persist();
}
function optimize(){
 const button=$("optimize-button");
 if(worker){
   calculationRevision++;
   worker.terminate();worker=null;
   resetOptimizeButton();
   status("Optimization cancelled. Your settings are unchanged.");return;
 }
 readInputs();
 if(!$("skill-points").value){status("Enter your total Skill Points or import a player export.","error");return;}
 button.disabled=false;button.textContent=tr("Cancel optimization");
 status("Checking prerequisites and calculating the best allocation for the chosen scoring model…");
 const revision=++calculationRevision;
 const requestContext=publicOptimizationSettings(keepContractsConservative(structuredClone(state)));
 const running=new Worker(new URL("./worker.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&score=20261123-cadence-separated-r1&audit=20261123-ti-sensitivity-r1&alt=20261123-ti-second-tree-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1&ideal=20261126-boss-r1&security=20261126-audit56-r1&compat=20261126-audit56-r1&architecture=20261127-audit56-r1&pairrefine=20261127-r1&spellconstraints=20261127-r1&dimensional=20261127-r1&gearct=20261127-r1&warmstart=20261127-r1&gearfactor=20261127-r1&ctseeds=20261127-r1&poisonsprout=20261127-r1&specialspells=20261127-r1&warlordboss=20261127-r1",import.meta.url),{type:"module"});
 worker=running;
 running.onmessage=event=>{
   if(revision!==calculationRevision||worker!==running)return;
   const data=event.data;
   if(data.progress){
     const phase=data.progress.phase==="pet-scenarios"?"Comparing pet setups":data.progress.phase==="skills"?"Building skill-tree options":"Combining skill trees";
     status("{phase}: {completed}/{total} complete. You can cancel at any time.","",{phase,completed:data.progress.completed,total:data.progress.total});
     return;
   }
   resetOptimizeButton();
   if(data.ok){
    lastEquipment=data.equipment||{};
    lastGearSelection=data.gearSelection??null;
    lastResolvedPets=data.selectedPets??null;
    lastRunContext=requestContext;
    lastResult=data.result;renderResults(data.result);persist();
    if(data.petSearch?.converged===false)
    status("Pet comparison has not converged: the selected pair is provisional. Current SP investments remain protected.","");
   else if(data.result.modeledScenario?.coverage?.inventoryTruncated)
    status("Equipment inventory is truncated: automatic gear ranking was disabled. Scores are incomplete.","");
   else
    status(data.result.optimality?.mode==="bounded-power"?"Build ready with a certified upper bound on the score gap. See accuracy details below.":"Build optimized. Copy the result to import it into TT2.","success");}
   else{status(data.error||"Optimization failed.","error");$("result-mode").textContent="Could not optimize";}
   running.terminate();if(worker===running)worker=null;
 };
 running.onerror=event=>{
  if(revision!==calculationRevision||worker!==running)return;
  resetOptimizeButton();
  status("Optimizer worker failed: {detail}","error",
   {detail:event.message||"unknown error"});
  running.terminate();worker=null;
 };
 // The public experience has one fixed, owned pet per automatic slot.
 // Historical pair-comparison mode remains available for internal tests only.
 running.postMessage({type:"optimize",settings:requestContext});
}
// Rendering and scoring are separated: this controller coordinates state only.
const renderAccountIntegration=createAccountDiagnosticsRenderer({
 getById:$,doc:document,tr,numberText,formatLogMultiplier,seasonNotice:SEASON14_NOTICE
});
const {renderAttackChannelEvidence,
 renderModelAttribution,
 renderBossPushEvidence}=createResultDetailRenderers({
 getById:$,doc:document,tr,safe,numberText,exportBuild
});
function renderResults(result,scroll=true){
 $("empty-results").hidden=true;$("actual-results").hidden=false;
 if(scroll){
  const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
  $("results").scrollIntoView({behavior:reducedMotion?"auto":"smooth",block:"start"});
 }
 const bounded=result.optimality?.mode==="bounded-power";
 $("result-mode").textContent=tr(bounded?"Optimized · bounded grid":"Optimized · exact DP");
 const scenario=lastRunContext??state;
 $("build-title").textContent=tr(scenario.damage)+" · "+
  tr(scenario.gold==="HoG"?"Heart of Gold":scenario.gold);
 $("build-subtitle").textContent=tr(PRESETS[scenario.playstyle]?.label||"Balanced")+" · "+tr("Weighted log-damage/gold model");
 const assumptions=result.combatAssumptions||{};
 $("combat-assumptions-summary").textContent=tr(
   "Modeled at the limit-stage boss: Hayst {hayst}, Snap {snap}, Astral Awakening {stacks}/5 taps.",
   {hayst:tr(assumptions.hayst?"active":"inactive"),
    snap:tr(assumptions.snap?"active":"inactive"),stacks:assumptions.astralActivations??0});
 $("combat-assumptions-summary").textContent+=" · "+tr("Boss scenario: {poison} poison application(s), {sprout} source Sprout stacks; activation not measured.",
  {poison:assumptions.poisonApplications??0,sprout:assumptions.sproutStacks??0});
 const target=result.pushSkipTarget;
 if(target?.enabled){
  $("combat-assumptions-summary").textContent+=" · "+tr(
   "Source Stage Skip target: {attack}, {value} from {skill} (talent level {level}). Actual boss kill and total Stage Skip are not verified.",
   {attack:target.attackLabel,value:numberText(target.actualSourceStageSkip),
    skill:target.sourceSkillName,level:numberText(target.actualLevel)});
 }
 $("combat-assumptions-summary").textContent+=" · "+tr(
  "Coordinated Offensive active at boss: {status}.",
  {status:tr(assumptions.coordinatedOffensive?"yes":"no")});
 $("combat-assumptions-summary").textContent+=" · "+tr(
  "Boss specials: Flash Zip {fz}; Nightmare {nm}; Magnum Opus {mo}.",
  {fz:tr(assumptions.flashZipAtBoss?"yes":"no"),
   nm:tr(assumptions.nightmareAtBoss?"yes":"no"),
   mo:tr(assumptions.magnumOpusAtBoss?"yes":"no")});
 $("combat-assumptions-summary").textContent+=" · "+tr("Boss spell specials: Thunder Volley {tv}; Blade Stream target {bs}.",
  {tv:tr(assumptions.thunderVolleySpecialAtBoss?"yes":"no"),
   bs:tr(assumptions.bladeStreamTargetAtBoss?"yes":"no")});
 $("combat-assumptions-summary").textContent+=" · "+tr("Boss scenario: Clan Ship stun {stun}; inspired hero damage {inspired}. Activation is assumed, not measured.",
  {stun:tr(assumptions.anchoringShotStunAtBoss?"yes":"no"),
   inspired:tr(assumptions.inspiredHeroesAtBoss?"yes":"no")});
 const guarded=result.protectedSkills||[];
 if(guarded.length){
   const names=guarded.map(id=>SKILLS[id]?.Name||id).join(", ");
   $("combat-assumptions-summary").textContent+=" · "+
     tr("Existing conditional skills preserved because their effects are not fully modeled: {skills}",{skills:names});
 }
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
 $("branch-chart").innerHTML=Object.entries(result.branchTotals).map(([name,points])=>`<div class="branch-row"><div class="branch-header"><span>${safe(tr(name))}</span><strong>${numberText(points)} SP</strong></div><div class="progress-track"><div class="progress-fill"></div></div></div>`).join("");
 // Apply trusted numeric/color values through CSSOM, not inline HTML styles.
 const fills=$("branch-chart").querySelectorAll(".progress-fill");
 Object.entries(result.branchTotals).forEach(([name,points],index)=>{
  fills[index].style.width=(points/max*100)+"%";
  fills[index].style.background=branchColors[name];
 });
 renderEquipmentRecommendations();
 renderAccountIntegration(result);
 renderAttackChannelEvidence(result);
 renderModelAttribution(result);
 renderBossPushEvidence(result);
 $("full-tree").innerHTML=Object.entries(BRANCH_NAMES).map(([code,name])=>`<h4 class="group-title">${safe(tr(name))}</h4>`+SKILL_IDS.filter(id=>SKILLS[id].Branch===code&&result.levels[id]>0).map(id=>`<div class="tree-row"><span>${safe(SKILLS[id].Name)}</span><strong>${result.levels[id]}</strong></div>`).join("")).join("");
 $("delta-count").textContent="("+result.changes.length+")";
 $("diff-list").innerHTML=result.changes.length?result.changes.map(change=>`<div class="change-row"><span>${safe(change.name)}</span><span><small>${change.before} → ${change.after}</small> <strong class="${change.difference>=0?"plus":"minus"}">${change.difference>0?"+":""}${change.difference}</strong></span></div>`).join(""):"<p class='hint'>"+safe(tr("No skill-level changes."))+"</p>";
 $("export-json").value=exportBuild(result.levels);
}
function decodeLink(){
 const hash=window.location.hash;
 if(!hash.startsWith("#build="))return;
 try{
  const payload=readSharedBuild(hash,SKILLS,DAMAGE_TYPES,GOLD_TYPES);
  state=publicOptimizationSettings({...fresh(),...payload,
   maxStage:capCurrentMaxStage(payload.maxStage,null,payload.stageSeason===14)});
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  status("Shared build settings loaded. Optimize to calculate a new recommendation.","success");
 }catch(e){status("Could not load this shared build link.","error");}
}
function initialize(){
 try{state=restoreSavedBuild(localStorage,fresh(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);}
 catch{state=fresh();}
 decodeLink();
 state=publicOptimizationSettings(state);
 // Retired UI settings from previous sessions must not influence diagnostics.
 delete state.pushObservedAttackChannelId;
 delete state.pushObservedHitDamage;
 delete state.pushBossStage;
 manualCurrentStageConfirmed=state.stageSeason===14;
 state.maxStage=capCurrentMaxStage(state.maxStage,state.accountProfile,manualCurrentStageConfirmed);
 // Previous seasonal pet choices must not outlive the reset.
 const activePetIds=new Set(availablePets(state.accountProfile).map(p=>p.id));
 if(state.selectedDamagePet&&!activePetIds.has(state.selectedDamagePet))
  state.selectedDamagePet=null;
 if(state.selectedGoldPet&&!activePetIds.has(state.selectedGoldPet))
  state.selectedGoldPet=null;
 keepContractsConservative(state);
 persist();
 // Old manual toggles or old shared links must never override the export.
 // No completed-set collection means unknown ownership, not zero owned in-game.
 state.sets=ownedSetFlags(state.accountProfile);
 state.mode="power";fillInputs();
 const queryLang=new URL(location.href).searchParams.get("lang");
 const pathLang=document.documentElement.lang;
 // An explicitly visited localized URL always wins over a stored preference.
 const desired=SUPPORTED_LANGUAGES.includes(queryLang)?queryLang:pathLang;
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
 $("skill-search").addEventListener("input",e=>renderEditor(e.target.value));
 $("skill-editor").addEventListener("change",e=>{
  const t=e.target,id=t.dataset.level||t.dataset.minimum||t.dataset.exclude;
  if(!id)return;
  if(t.dataset.level){
   state.currentLevels[id]=Number(t.value);
  }
  if(t.dataset.minimum)state.minimums[id]=Number(t.value);
  if(t.dataset.exclude)state.excluded=t.checked?[...new Set([...state.excluded,id])]:state.excluded.filter(x=>x!==id);
  remember();
 });
 $("clear-minimums").addEventListener("click",()=>{state.minimums={};fillInputs();remember();});
 for(const id of ["skill-points","max-stage","gold-weight","crafting-power",
  "time-to-kill","clone-level","qol-mode","preserve-current",
  "protect-unmodeled-skills"])$(id).addEventListener("change",()=>{
  readInputs();remember();
 });
 // Cancel an ongoing optimization as soon as the settings change.
 for(const id of ["skill-points","max-stage","gold-weight",
  "crafting-power","time-to-kill","clone-level"]){
  $(id).addEventListener("input",()=>{if(worker){readInputs();remember();}});
 }
 $("skill-editor").addEventListener("input",e=>{
  if(!worker)return;
  const input=e.target,id=input.dataset.level||input.dataset.minimum;
  if(!id)return;
  if(input.dataset.level)state.currentLevels[id]=Number(input.value);
  else state.minimums[id]=Number(input.value);
  remember();
 });
 $("clear-local-data").addEventListener("click",()=>{
  if(!window.confirm(tr("Erase all locally saved TT2 data from this browser?")))return;
  if(worker){worker.terminate();worker=null;}
  let erased=false;
  try{erased=eraseSavedBrowserData(localStorage);}catch{}
  if(!erased){
   status("Unable to erase saved browser data. Check your browser storage permissions.","error");
   return;
  }
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  window.location.reload();
 });
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
  try{
   const link=createShareableBuildLink(window.location.href,
    state,fresh(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
   const copied=await copyText(link);
   status(copied?"Shareable link copied. Note: it contains the TT2 settings you entered.":"Copy failed. Check browser clipboard permissions.",copied?"success":"error");
  }catch{status("Cannot share a build with invalid or excessive settings. Check the skill levels and SP budget.","error");}
 });
}
// Static localized pages select exactly one catalog before dynamic rendering.
// A failed catalog request must not make the calculator unusable.
try{await loadLocale(document.documentElement.lang);}
catch(error){console.error("Unable to load TT2 translation catalog",error);}
initialize();
