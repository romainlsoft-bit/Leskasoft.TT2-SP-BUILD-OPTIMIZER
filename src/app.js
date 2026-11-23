import {SKILLS,SKILL_IDS,BRANCH_NAMES,PRESETS,DAMAGE_TYPES,GOLD_TYPES,GAME_VERSION,parseExport,exportBuild,spentPoints,ownedSetFlags} from "./engine.js?v=20261123-boss-specials-r1&score=20261123-cadence-separated-r1&audit=20261123-ti-sensitivity-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1";
import { t, localizeDocument, SUPPORTED_LANGUAGES } from "./i18n.js?v=20261123-boss-specials-r1&ui=20261123-hide-observed-hit-r1&audit=20261123-ti-sensitivity-r1&alt=20261123-ti-second-tree-r1";
import { readClipboardText } from "./clipboard.js?v=20261123-boss-specials-r1";
import {resetAccountDependentOptions} from "./import-session-reset.js?v=20261123-boss-specials-r1";
import { profileCoverage } from "./account-profile.js?v=20261123-boss-specials-r1";
import {petLevelEvidence} from "./account-pet-levels.js?v=20261123-boss-specials-r1";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261123-boss-specials-r1";
import {formatLogMultiplier} from "./account-power.js?v=20261123-boss-specials-r1";
import {availablePets,recommendPets} from "./pet-scenarios.js?v=20261123-boss-specials-r1";
import {bestEquipmentByCategory,EQUIPMENT_CATEGORIES} from "./equipment-scenarios.js?v=20261123-boss-specials-r1";
import {sourcedStageSkipChannels,sourcedDamageChannels,attackChannelEvidence} from "./attack-channels.js?v=20261123-boss-specials-r1";
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
 renderAccountProfile();renderPetControls();renderPushStageSkipOptions();
 renderNativeAttackOptions();
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
const fresh=()=>({damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,playstyle:"balanced",qol:"recommended",goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,sets:{},currentLevels:{},minimums:{},excluded:[],preserveCurrent:false,assumeCoordinatedOffensiveActive:false,assumeFlashZipAtBoss:false,assumeNightmareAtBoss:false,assumeMagnumOpusAtBoss:false,assumeHaystActive:false,assumeSnapActive:false,assumeContractsAtMax:false,astralActivations:0,mode:"power",accountProfile:null,selectedDamagePet:null,selectedGoldPet:null,comparePetScenarios:true,selectedEquipment:{},protectUnmodeledSkills:true,excludeUnverifiedTacticalInsight:false,tacticalInsightCalibration:null,contractTimeline:null,contractMultiScenario:null,
 importedVersion:null,budgetSource:"unset",budgetInconsistent:false,
 pushAttackChannelId:"",pushSourceStageSkipTarget:0,
 pushFrontierEnabled:false,attackDamageFrontierEnabled:false,attackDamageChannelId:""});
let state=fresh(),lastResult=null,lastScenarios=[],lastEquipment={},
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
function persist(){try{localStorage.setItem("tt2_skill_optimizer_v1",JSON.stringify(state));}catch{}}
function renderChoices(){
  $("damage-choices").innerHTML=DAMAGE_TYPES.map(x=>`<button class="choice ${state.damage===x?"selected":""}" type="button" data-damage="${safe(x)}" aria-pressed="${state.damage===x}"><span>${iconMap[x]}</span>${safe(tr(x))}</button>`).join("");
  $("gold-choices").innerHTML=GOLD_TYPES.map(x=>`<button class="${state.gold===x?"selected":""}" type="button" data-gold="${safe(x)}" aria-pressed="${state.gold===x}">${safe(tr(x==="HoG"?"Heart of Gold":x))}</button>`).join("");
  document.querySelectorAll("[data-playstyle]").forEach(btn=>{const active=btn.dataset.playstyle===state.playstyle;btn.classList.toggle("selected",active);btn.setAttribute("aria-pressed",String(active));});
}
function renderEditor(filter=""){
 const q=filter.trim().toLowerCase();const matches=SKILL_IDS.filter(id=>SKILLS[id].Name.toLowerCase().includes(q)||BRANCH_NAMES[SKILLS[id].Branch].toLowerCase().includes(q)||tr(BRANCH_NAMES[SKILLS[id].Branch]).toLowerCase().includes(q));
 $("skill-editor").innerHTML='<div class="skill-colhead"><span>'+safe(tr("Skill"))+'</span><span>'+safe(tr("Current"))+'</span><span>'+safe(tr("Minimum"))+'</span><span>'+safe(tr("Exclude"))+'</span></div>'+matches.map(id=>{
  const s=SKILLS[id];return `<div class="skill-row"><span class="skill-name">${safe(s.Name)}<small>${safe(tr(BRANCH_NAMES[s.Branch]))} · max ${s.MaxLevel}</small></span><input type="number" data-level="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.currentLevels?.[id]||0}" aria-label="${safe(tr("Current level for {name}",{name:s.Name}))}"><input type="number" data-minimum="${id}" min="0" max="${s.MaxLevel}" step="1" value="${state.minimums?.[id]||0}" aria-label="${safe(tr("Minimum level for {name}",{name:s.Name}))}"><div class="center"><input type="checkbox" data-exclude="${id}" aria-label="${safe(tr("Exclude {name}",{name:s.Name}))}" ${state.excluded?.includes(id)?"checked":""}></div></div>`;
 }).join("");
 if(!matches.length)$("skill-editor").innerHTML="<p class='hint'>"+safe(tr("No skills match your search."))+"</p>";
}
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
 if(String(state.importedVersion||"").startsWith("8.4.1"))
  el.textContent+=" "+tr(
   "This account export reports TT2 8.4.1. The mathematical catalog is verified against 8.4.0; compatibility with later live data has not been independently confirmed.");
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
   else if(id==="pet-compare")state.comparePetScenarios=target.checked;
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
  html+='<p class="hint">'+safe(tr("A damage pet and a gold pet are selected together. Automatic slots search eligible owned pets; named choices stay fixed."))+'</p>'
   +'<div class="field-grid"><label>'+safe(tr("Damage pet"))+'<select id="pet-damage-select">'+renderOptions("damage",state.selectedDamagePet)+'</select></label>'
   +'<label>'+safe(tr("Gold pet"))+'<select id="pet-gold-select">'+renderOptions("gold",state.selectedGoldPet)+'</select></label></div>'
   +'<label class="toggle"><input id="pet-compare" type="checkbox" '+(state.comparePetScenarios?"checked":"")+'>'+
     safe(tr("Compare automatic pet choices"))+'</label>';
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
function renderPetComparisons(){
 let el=$("pet-comparison-results");
 if(!el){
  el=document.createElement("div");el.id="pet-comparison-results";el.className="result-detail";
  $("branch-chart").insertAdjacentElement("afterend",el);
  el.addEventListener("click",event=>{
   const button=event.target.closest("button[data-scenario-index]");
   if(!button)return;
   const selected=lastScenarios[Number(button.dataset.scenarioIndex)];
   if(!selected)return;
   state.selectedDamagePet=selected.damagePet;state.selectedGoldPet=selected.goldPet;
   lastGearSelection=selected.gearSelection??null;
   lastResolvedPets={damage:selected.damagePet,gold:selected.goldPet};
   lastResult=selected.result;fillInputs();persist();renderResults(selected.result,false);
  });
 }
 if(!lastScenarios.length){el.hidden=true;return;}
 el.hidden=false;
 const sections=[["damage",tr("Damage pets")],["gold",tr("Gold pets")]];
 const renderSection=([slot,title])=>{
  const list=lastScenarios.map((x,i)=>({...x,index:i})).filter(x=>x.slot===slot);
  if(!list.length)return "";
  list.sort((a,b)=>b.adjustedScore-a.adjustedScore);
  const best=list[0].adjustedScore;
  return '<h4>'+safe(title)+'</h4><div class="table-wrapper"><table><thead><tr><th>'
   +safe(tr("Pet"))+'</th><th>'+safe(tr("Gap to best"))+'</th><th>SP</th><th></th></tr></thead><tbody>'
   +list.map(item=>'<tr><td>'+safe(slot==="damage"?item.damageName:item.goldName)+'</td><td>'
    +(best-item.adjustedScore).toFixed(3)+' log10</td><td>'+numberText(item.result.spent)
    +' SP</td><td><button type="button" class="btn tiny secondary" data-scenario-index="'+item.index+'">'
    +safe(tr("Select"))+'</button></td></tr>').join("")
   +'</tbody></table></div>';
 };
 el.innerHTML='<h3>'+safe(tr("Compared pet setups"))+'</h3>'
  +'<p class="hint">'+safe(tr("Damage and Gold pet rankings are independent; only changed skill-tree branches are recalculated. These are theoretical scores, not guaranteed stages."))+'</p>'
  +sections.map(renderSection).join("");
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

function renderPushStageSkipOptions(){
 const select=$("push-attack-channel");
 const channels=sourcedStageSkipChannels(state.damage);
 const eligible=channels.some(c=>c.id===state.pushAttackChannelId);
 if(state.pushAttackChannelId&&!eligible){
  // Never import a channel-specific target into an unrelated build.
  state.pushAttackChannelId="";
  state.pushSourceStageSkipTarget=0;
 }
 select.innerHTML="<option value=''>"+safe(tr("No target"))+"</option>"+
  channels.map(c=>"<option value='"+safe(c.id)+"'>"+safe(tr(c.label))+
   " · "+safe(SKILLS[c.sourceSkillId]?.Name||c.sourceSkillId)+"</option>").join("");
 select.value=state.pushAttackChannelId||"";
}
function renderNativeAttackOptions(){
 const select=$("attack-damage-channel");
 const channels=sourcedDamageChannels(state.damage);
 const valid=channels.some(c=>c.id===state.attackDamageChannelId);
 if(!valid){
  // Never carry a Pet attack source into a Clan Ship or Dagger build.
  const preferred=channels.find(c=>c.role==="burst"&&!c.requiredSpell)||
   channels[0];
  state.attackDamageChannelId=preferred?.id||"";
 }
 select.innerHTML=channels.map(c=>
  "<option value='"+safe(c.id)+"'>"+safe(tr(c.label))+
  " · "+safe(c.sourceSkillName)+"</option>").join("");
 select.value=state.attackDamageChannelId;
}
function fillInputs(){
 renderAccountProfile();renderPetControls();
 $("skill-points").value=state.skillPoints??"";
 $("max-stage").value=state.maxStage||"";
 $("gold-weight").value=state.goldWeight;
 $("crafting-power").value=state.craftingPower;
 $("time-to-kill").value=state.timeToKill;
 $("clone-level").value=state.sClone;
 $("qol-mode").value=state.qol;
 $("preserve-current").checked=state.preserveCurrent;
 $("protect-unmodeled-skills").checked=state.protectUnmodeledSkills!==false;
 $("exclude-unverified-tactical-insight").checked=state.excludeUnverifiedTacticalInsight===true;
 const calibration=state.tacticalInsightCalibration||{};
 $("ti-cal-enabled").checked=calibration.enabled===true;
 for(const [key,id] of [["lowerLevel","ti-cal-low-level"],
  ["upperLevel","ti-cal-high-level"],
  ["lowerDamage","ti-cal-low-damage"],["upperDamage","ti-cal-high-damage"],
  ["lowerGold","ti-cal-low-gold"],["upperGold","ti-cal-high-gold"]]){
  $(id).value=calibration[key]??"";
 }
 $("coordinated-offensive-active").checked=state.assumeCoordinatedOffensiveActive===true;
 $("flash-zip-at-boss").checked=state.assumeFlashZipAtBoss===true;
 $("nightmare-at-boss").checked=state.assumeNightmareAtBoss===true;
 $("magnum-opus-at-boss").checked=state.assumeMagnumOpusAtBoss===true;
 $("hayst-active").checked=state.assumeHaystActive===true;
 $("snap-active").checked=state.assumeSnapActive===true;
 $("astral-activations").value=state.astralActivations??0;
 renderPushStageSkipOptions();
 renderNativeAttackOptions();
 $("attack-damage-frontier-enabled").checked=state.attackDamageFrontierEnabled===true;
 $("push-stage-skip-target").value=state.pushSourceStageSkipTarget??0;
 $("push-frontier-enabled").checked=state.pushFrontierEnabled===true;
 renderChoices();renderEditor($("skill-search").value);
}
function remember(){
 calculationRevision++;
 if(worker){worker.terminate();worker=null;resetOptimizeButton();}
 persist();lastScenarios=[];lastEquipment={};lastGearSelection=null;
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
 state.maxStage=Number($("max-stage").value)||0;
 state.goldWeight=Number($("gold-weight").value);
 state.craftingPower=Number($("crafting-power").value);
 state.timeToKill=Number($("time-to-kill").value);
 state.sClone=Number($("clone-level").value);
 state.qol=$("qol-mode").value;
 state.preserveCurrent=$("preserve-current").checked;
 state.protectUnmodeledSkills=$("protect-unmodeled-skills").checked;
 state.excludeUnverifiedTacticalInsight=$("exclude-unverified-tactical-insight").checked;
 state.tacticalInsightCalibration=$("ti-cal-enabled").checked?{
  enabled:true,damage:state.damage,gold:state.gold,
  lowerLevel:$("ti-cal-low-level").value,upperLevel:$("ti-cal-high-level").value,
  lowerDamage:$("ti-cal-low-damage").value.trim(),
  upperDamage:$("ti-cal-high-damage").value.trim(),
  lowerGold:$("ti-cal-low-gold").value.trim(),
  upperGold:$("ti-cal-high-gold").value.trim()
 }:null;
 state.assumeCoordinatedOffensiveActive=$("coordinated-offensive-active").checked;
 state.assumeFlashZipAtBoss=$("flash-zip-at-boss").checked;
 state.assumeNightmareAtBoss=$("nightmare-at-boss").checked;
 state.assumeMagnumOpusAtBoss=$("magnum-opus-at-boss").checked;
 state.assumeHaystActive=$("hayst-active").checked;
 state.assumeSnapActive=$("snap-active").checked;
 state.pushAttackChannelId=$("push-attack-channel").value;
 state.pushSourceStageSkipTarget=$("push-stage-skip-target").value;
 state.pushFrontierEnabled=$("push-frontier-enabled").checked;
 state.attackDamageFrontierEnabled=$("attack-damage-frontier-enabled").checked;
 state.attackDamageChannelId=$("attack-damage-channel").value;
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
 const requestContext=keepContractsConservative(structuredClone(state));
 const running=new Worker(new URL("./worker.js?v=20261123-boss-specials-r1&score=20261123-cadence-separated-r1&audit=20261123-ti-sensitivity-r1&alt=20261123-ti-second-tree-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1",import.meta.url),{type:"module"});
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
    lastScenarios=[...(data.petComparisons?.damage||[]),
     ...(data.petComparisons?.gold||[])];
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
 const compare=requestContext.comparePetScenarios&&
  availablePets(requestContext.accountProfile).length>0;
 running.postMessage({type:compare?"optimize-pet-scenarios":"optimize",
  settings:requestContext});
}
function renderAccountIntegration(result){
 let panel=$("account-integration-diagnostic");
 if(!panel){
  panel=document.createElement("div");
  panel.id="account-integration-diagnostic";
  panel.className="result-detail account-integration-note";
  panel.setAttribute("role","status");
  const disclaimer=document.querySelector(".math-disclaimer");
  if(!disclaimer)return;
  disclaimer.insertAdjacentElement("afterend",panel);
 }
 const power=result.fixedAccount,coverage=result.accountIntegration;
 if(!power||!coverage){panel.hidden=true;return;}
 const counts=Number(coverage.unmodeledEffects||0);
 const timed=coverage.timedSetPower||{};
 const knownOrUnknown=n=>Number.isSafeInteger(n)&&n>=0?numberText(n):tr("not verifiable from this export");
 panel.hidden=false;
 panel.textContent=tr(
  "Account baseline (verified formulas only): Damage {damage}, Gold {gold}; {count} numerical effects imported. {unresolved} artifact/set effects remain uncalibrated. Not a validated total build-power estimate.",
  {
   damage:formatLogMultiplier(power.damageLog10),
   gold:formatLogMultiplier(power.goldLog10),
   count:numberText(power.matched||0),
   unresolved:numberText(counts)
  }
 )+" "+tr("Coverage: timed effects scored {applied}/{total}; hero weapon sets {weapons}; Clan Scroll sets {scrolls}. These figures are not predicted stages.",{
  applied:numberText(timed.applied||0),
  total:numberText(timed.calculated||0),
  weapons:knownOrUnknown(coverage.heroWeaponFullSets),
  scrolls:knownOrUnknown(coverage.clanScrollCompleteSets)
 });
 const petAudit=coverage.petPassives;
 if(petAudit?.imported>0)
  panel.textContent+=" "+tr(
   "Pet audit: {imported} pets, {direct} fixed passive bonuses ({seasonal} Transcendent), {gear} seasonal equipment-pet primaries and {unscored} conditional pet effects not included in fixed damage. Tap/Hero damage is build-reduced, not universal. No stages predicted.",
   {imported:numberText(petAudit.imported),
    direct:numberText(petAudit.scored),
    seasonal:numberText(petAudit.seasonalDirect||0),
    gear:numberText(petAudit.seasonalEquipment||0),
    unscored:numberText(petAudit.unscoredDependent||0)});
 const hero=coverage.heroProgression,clan=coverage.clanScrollPower;
  if(hero&&(hero.rosterVerified||hero.missingHeroes<37))
   panel.textContent+=" "+tr(
    "Hero weapons: {sets} full sets, base damage {damage}, Ringing: {ringing}, Worldshaper: {mythic}; dominant hero: {hero}. Individual weapon and helmet conversions still require hero DPS.",
    {sets:knownOrUnknown(hero.fullSets),
      damage:hero.baseSetLog10===null?tr("not verifiable from this export"):
       formatLogMultiplier(hero.baseSetLog10),
      ringing:hero.ringing?.verified?tr("yes"):tr("no"),
      mythic:hero.mythicSmith?.applied?tr("yes"):tr("no"),
      hero:hero.strongest?.verified?hero.strongest.id+" ("+hero.strongest.heroClass+")":
       tr("not verifiable from this export")});
  if(clan?.recognized>0)
   panel.textContent+=" "+tr(
    "Clan Scrolls: {count} recognized, full roster: {complete}; Quill: {quill}, Stamp: {stamp}, Dragon Weaver: {dragon}. Cross-stacking may be unresolved; this is not a stage forecast.",
    {count:numberText(clan.recognized),complete:clan.completeRoster?tr("yes"):tr("no"),
     quill:clan.quill?.applied?tr("yes"):tr("no"),
     stamp:clan.stamp?.applied?tr("yes"):tr("no"),
     dragon:clan.scrollTutor?.applied?tr("yes"):tr("no")});
  if(hero?.heroLevels?.present)
   panel.textContent+=" "+tr(
    "Hero level/ascension snapshot: {count} heroes, complete: {complete}, current DPS: {dps}. Already-applied weapon/helmet bonuses are never counted twice.",
    {count:numberText(hero.heroLevels.parsedCount),
      complete:hero.heroLevels.completeRoster?tr("yes"):tr("no"),
      dps:hero.heroLevels.dpsComplete?tr("available"):tr("not verifiable from this export")});
  const artifacts=coverage.artifacts;
 if(artifacts&&(artifacts.identified>0||artifacts.unknownIds>0||
    artifacts.explicitlyUnowned>0||artifacts.truncated)){
  const knownFactor=n=>Number.isFinite(n)?numberText(n):
   tr("not verifiable from this export");
  panel.textContent+=" "+tr(
   "Artifacts: {count} recognized, {scored} scored main effects; Magnifier ×{magnifier} affecting {damageTargets} artifacts, Fergus ×{fergus} affecting {goldTargets}. White Dwarf ownership count: {owned}. Additive Artifact Damage is a conservative baseline, not predicted stages.",
   {count:numberText(artifacts.identified||0),scored:numberText(artifacts.modeled||0),
    magnifier:knownFactor(artifacts.magnifier?.factor),
    damageTargets:numberText(artifacts.supportedMagnifierTargets||0),
    fergus:knownFactor(artifacts.treasure?.factor),
    goldTargets:numberText(artifacts.supportedTreasureTargets||0),
    owned:knownOrUnknown(artifacts.ownedArtifactCount)});
  if(artifacts.unknownIds>0||artifacts.explicitlyUnowned>0||artifacts.truncated)
   panel.textContent+=" "+tr(
    "Artifact source warnings: {unknown} unknown IDs, {unowned} salvaged or explicitly unowned records, truncated: {truncated}. Unverifiable effects and White Dwarf counts are excluded rather than guessed.",
    {unknown:numberText(artifacts.unknownIds||0),
     unowned:numberText(artifacts.explicitlyUnowned||0),
     truncated:artifacts.truncated?tr("yes"):tr("no")});
 }
 const permanent=coverage.permanentSetPower;
 if(permanent?.recognizedSets>0){
  panel.textContent+=" "+tr(
   "Permanent sets: {sets} unlocked (including {unique} Unique); {direct} direct bonuses and {gear} equipment-primary boosts calculated using Crafting Power {cp}. These are not a complete damage model.",
   {sets:numberText(permanent.recognizedSets),
    unique:numberText(permanent.uniqueOwned||0),
    direct:numberText(permanent.directEffects||0),
    gear:numberText(permanent.equipmentEffects||0),
    cp:permanent.craftingPower?.level===null
     ?tr("not verifiable from this export")
     :numberText(permanent.craftingPower.level)}
  );
  if(permanent.countedEffectsApplied>0)
   panel.textContent+=" "+tr(
    "{count} effects per owned equipment set were scored from the completed-set collection ({mythic} Mythic, {legendary} Legendary and {unique} Unique sets).",
    {count:numberText(permanent.countedEffectsApplied),
     mythic:numberText(permanent.ownedCounts?.Mythic||0),
     legendary:numberText(permanent.ownedCounts?.Legendary||0),
     unique:numberText(permanent.ownedCounts?.Unique||0)});
  if(permanent.ownedRosterComplete===false)
   panel.textContent+=" "+tr(
    "Bonuses per completed set cannot be verified without a complete unlocked-set collection; unknown counts were not scored.");
  if(permanent.conservativeCPBaseEffects>0)
   panel.textContent+=" "+tr(
    "{count} set multipliers use only their minimum unboosted value because Crafting Power is not confirmed.",
    {count:numberText(permanent.conservativeCPBaseEffects)});
  if(permanent.craftingPower?.conflictingSettings)
   panel.textContent+=" "+tr(
    "The Crafting Power from the account export overrides a conflicting form value.");
 }
 const monuments=coverage.monuments;
 if(monuments&&(monuments.identified>0||monuments.unknownIds>0||
    monuments.truncatedSections?.length)){
  panel.textContent+=" "+tr("Monuments (season {season}): {known} recognized, {scored} primary/count effects scored. Additive Monument Damage: {damage} from {components} eligible monuments, included only once as a conservative All Damage baseline. Enchantment multipliers are not guessed; neither these values nor the proxy are stage predictions.",{
   season:monuments.season??tr("not verifiable from this export"),
   known:numberText(monuments.identified||0),
   scored:numberText(monuments.scored||0),
   damage:formatLogMultiplier(monuments.additiveDamageLog10),
   components:numberText(monuments.additiveComponents||0)
  });
  if(monuments.unknownIds||monuments.conflicts||monuments.truncatedSections?.length||
    monuments.additiveUnrepresentable){
   panel.textContent+=" "+tr("Monument limitations: {unknown} unknown IDs, {conflicts} stale/conflicting entries, {truncated} truncated sections and {unrepresentable} non-representable damage terms. Missing season, per-day conditions and unverified completed-set counts remain excluded.",{
    unknown:numberText(monuments.unknownIds||0),
    conflicts:numberText(monuments.conflicts||0),
    truncated:numberText(monuments.truncatedSections?.length||0),
    unrepresentable:numberText(monuments.additiveUnrepresentable||0)
   });
  }
 }
 const treeSets=coverage.skillTreeSetPower;
 if(treeSets?.applied>0)
  panel.textContent+=" "+tr(
   "Skill-tree mythic sets: {count} active bonuses contribute {damage} log10 All Damage from the actual SP allocation. This contribution is already inside the skill score.",
   {count:numberText(treeSets.applied),
    damage:treeSets.skillScoreLog10.toFixed(2)});
 if(treeSets?.completedSetRosterPresent===false)
  panel.textContent+=" "+tr(
   "No unlocked-set collection was found in the export; skill-tree set bonuses cannot be verified.");
 const spells=result.spellScenario;
 const mana=result.manaEvidence;
 if(spells){
  panel.textContent+=" "+tr(
   "Spells: {count}/6 equipped slots verified: {verified}; max-level scenario: {active}; selected spell baseline: {damage} damage, {gold} gold. Unverified loadouts contribute no spell multiplier.",
   {count:numberText(spells.slots),verified:spells.selection?.valid?tr("yes"):tr("no"),
     active:spells.assumedMaxLevelScenario?tr("yes"):tr("no"),
     damage:formatLogMultiplier(spells.damageLog10),
     gold:formatLogMultiplier(spells.goldLog10)});
 }
 if(spells?.recommendation?.ids?.length)
  panel.textContent+=" "+tr(
   "Source-based six-spell candidates: {spells}. Suggestions only: not automatically equipped, not scored, and not mana/uptime optimized.",
   {spells:spells.recommendation.ids.join(", ")});
 if(mana)
  panel.textContent+=" "+tr(
   "Mana audit: {cost} mana for one cast of each selected spell; exported pool: {pool}, regen: {regen}. Multicast, contract ramp and actual uptime remain unverified.",
   {cost:mana.spellManaCostOneCast===null?tr("not verifiable from this export"):
     numberText(mana.spellManaCostOneCast),
    pool:mana.exportedFinalManaPool===null?tr("not verifiable from this export"):
     numberText(mana.exportedFinalManaPool),
    regen:mana.exportedFinalManaRegenPerSecond===null?
     tr("not verifiable from this export"):numberText(mana.exportedFinalManaRegenPerSecond)});
 const sourceCoverage=result.accountSourceCoverage;
 if(sourceCoverage?.seasonCalendar?.estimatedSeasonEnded)
  panel.textContent+=" "+tr(
   "The season-13 export may now be obsolete: a community calendar lists November 24, 2026 as the last day. Old-season monuments and Transcendent pets are excluded conservatively from November 25 UTC; import a current game export. This end date is not confirmed by Game Hive.");
 if(sourceCoverage){
  const system=id=>sourceCoverage.systems.find(x=>x.id===id);
  const desc=id=>{
   const x=system(id);
   return [x?.importedRecords??0,x?.fixedScoreRows??0,x?.unresolved??0]
    .map(numberText).join("/");
  };
  panel.textContent+=" "+tr(
   "Account calculation sources (imported / directly credited / unresolved): Titan research {titan}; Gemstone research {gemResearch}; gems {gems}; artifacts {artifacts}; monuments {monuments}. Titan Souls and extra Gemstone levels are progression resources, not automatically damage.",
   {titan:desc("titanResearch"),gemResearch:desc("gemstoneResearch"),
    gems:desc("gemstones"),artifacts:desc("artifacts"),
    monuments:desc("monuments")});
  panel.textContent+=" "+tr(
   sourceCoverage.clanTechnology?.present?
    "Clan Technology is recognized as a clan-wide system, but its exported effects cannot yet be independently verified or added to the SP score.":"Clan Technology is not included in this export; its clan-wide effects remain unknown.");
 }
 const monumentEnchant=result.accountIntegration?.monuments;
 if(monumentEnchant?.omittedEnchantmentBoosts>0&&
    Number.isFinite(monumentEnchant.hypotheticalEnchantmentDeltaLog10))
  panel.textContent+=" "+tr(
   "Monument enchantment what-if: +{delta} log10 versus the source-based conservative pool under an unverified stacking assumption. This bonus is NOT included in the SP score.",{
    delta:monumentEnchant.hypotheticalEnchantmentDeltaLog10.toFixed(2)});
 const seasonDay=result.monumentSeasonDay;
 if(seasonDay?.totalEntries>0)
  panel.textContent+=" "+tr(
   "Season-day monuments: {count} source effects identified, {calculable} illustrative compounded examples; none is silently credited as guaranteed damage. Season changes reset monuments.",{
    count:numberText(seasonDay.totalEntries),
    calculable:numberText(seasonDay.illustrableEntries)});
 const modeled=result.modeledScenario;
 if(modeled){
  panel.textContent+=" "+tr(
   "Modeled log10 score: skills {skills}, account {account}, equipped gear {gear}, active pets above passive {pets}; combined {total}. Not predicted stages.",
   {skills:modeled.skillLog10.toFixed(2),
    account:modeled.fixedAccountLog10.toFixed(2),
    gear:modeled.equippedGearLog10.toFixed(2),
    pets:modeled.activePetsAbovePassivesLog10.toFixed(2),
    total:modeled.totalLog10.toFixed(2)}
  );
 }
 if(result.modeledScenario?.coverage){
  const limitations=result.modeledScenario.coverage;
  if(limitations.inventoryTruncated)
   panel.textContent+=" "+tr("Incomplete equipment inventory: automatic gear selection is disabled.");
  if(limitations.missingExplicitSelections>0)
   panel.textContent+=" "+tr("{count} requested equipment choices could not be verified and were not scored.",
    {count:numberText(limitations.missingExplicitSelections)});
  if(limitations.conditionalSkillsUnverified>0)
   panel.textContent+=" "+tr("Some conditional skills have unverified activation or stacking; their damage was not guessed.");
  if(limitations.lightningStrikeCountUnverified)
   panel.textContent+=" "+tr("Lightning Strike hits per boss are unknown; current SP levels are protected, but no speculative damage is scored.");
  else if(limitations.lightningStrikeSourceOnly)
   panel.textContent+=" "+tr("Lightning Strike source-only estimate uses an explicitly supplied hit count; actual proc rate remains unverified.");
 }
 if(result.petSearch?.shortlistOnly)
  panel.textContent+=" "+tr(
   "Pet comparison may omit candidates in large owned rosters; compare only the evaluated setups.");
 const coupled=result.modeledScenario?.coverage;
 if(coupled?.petGearCoupledScreening)
  panel.textContent+=" "+tr("Coupled pet/gear search: equipment primaries are reconsidered for each active pet pair; {sources} equipment-pet passive sources, {excluded} seasonal rune interactions excluded. This is a bounded proxy, not a stage prediction.",{
   sources:numberText(coupled.petPrimarySourcesCount||0),
   excluded:numberText(coupled.excludedActiveSeasonalRune?.length||0)
  });
 const resources=coverage.researchResources;
 if(resources?.gemstones?.present||resources?.titanSouls?.present){
  const notKnown=tr("not verifiable from this export");
  const gems=resources.gemstones?.totalsVerifiable===true
   ?"+"+numberText(resources.gemstones.extraLevelsFromResearch):notKnown;
  const souls=resources.titanSouls;
  const soulKnown=souls?.totalsVerifiable===true;
  panel.textContent+=" "+tr(
   "Research from export: Gemstone Research {levels} levels; Titan Souls {daily}/day, {prestige}/prestige, +{chance}% raw drop chance. Resource bonuses are not damage multipliers.",
   {levels:gems,daily:soulKnown?"+"+numberText(souls.bonusPerDay):notKnown,
    prestige:soulKnown?"+"+numberText(souls.bonusPerPrestige):notKnown,
    chance:soulKnown?numberText(Math.round(souls.rawChanceBonusFraction*100000)/1000):notKnown}
  );
  if(resources.audit?.incomplete)panel.textContent+=" "+tr(
   "Research export is incomplete or contradictory: {count} ambiguous records/sections. Affected bonuses were excluded and aggregate resource rates cannot be verified.",
   {count:numberText(resources.audit.excludedOrConflictingNodes)});
 }
}
/**
 * Same table-backed attack / skip diagnostics for ALL damage builds.
 * Deliberately do not sum source modifiers, skip counts or cooldowns
 * into total hit damage or the SP optimization score.
 */
function renderAttackChannelEvidence(result){
 let el=$("attack-channel-diagnostics");
 if(!el){
  el=document.createElement("details");
  el.id="attack-channel-diagnostics";el.className="result-detail";
  $("combat-assumptions-summary").insertAdjacentElement("afterend",el);
 }
 const report=result.attackChannels;
 if(!report){el.hidden=true;return;}
 el.hidden=false;
 const rows=report.channels.map(channel=>{
  const bonus=channel.sourceModifierLog10===null?"":(" · "+
   safe(tr("Source talent modifier: +{value} log10 (not total hit damage)",
    {value:channel.sourceModifierLog10.toFixed(3)})));
  const skip=channel.skip.filter(x=>x.value!==null&&x.level>0&&x.value>0)
   .map(x=>safe(x.skillName)+": "+
    safe(tr(x.kind==="stage"?"Stage Skip":"Titan Skip"))+" "+
    safe(numberText(x.value))).join(" · ");
  const note=channel.status==="unverified-spell-selection"?
   " · "+safe(tr("Spell loadout unknown")):
   channel.status==="spell-not-equipped"?
    " · "+safe(tr("Required spell not equipped")):"";
  return "<div class='tree-row'><span><strong>"+safe(channel.label)+
   "</strong> · "+safe(channel.skillId)+" "+
   safe(tr("level"))+" "+safe(numberText(channel.level))+
   bonus+note+(skip?" · "+skip:"")+"</span></div>";
 });
 el.innerHTML="<summary>"+safe(tr("Attack channels and stage skips"))+
  "</summary><p class='hint'>"+
  safe(tr("Source-table diagnostics for the selected damage build. Stage Skip, cooldowns, hit damage and uptime are separate mechanics. No stage gain or combat DPS is predicted, and the SP score is unchanged."))+
  "</p>"+rows.join("");
}
/** Skill-level proxy attribution is intentionally separate from real attack DPS. */
function renderModelAttribution(result){
 let el=$("model-score-attribution");
 if(!el){
  el=document.createElement("details");
  el.id="model-score-attribution";el.className="result-detail";
  $("attack-channel-diagnostics").insertAdjacentElement("afterend",el);
 }
 const audit=result.modelAttribution;
 if(!audit){el.hidden=true;return;}
 el.hidden=false;
 const branches=Object.entries(audit.byBranch).map(([name,value])=>
  "<div class='tree-row'><span>"+safe(tr(name))+
  "</span><strong>"+safe(value.toFixed(2))+" log10</strong></div>");
 const top=audit.top.map(x=>
  "<div class='tree-row'><span>"+safe(x.name)+
  " · "+safe(tr(x.branch))+" · "+safe(tr("level"))+" "+
  safe(numberText(x.level))+
  (x.conditionalSourceUnverified?" · "+safe(tr("Conditional or unverified model weight")):"")+
  "</span><strong>"+safe(x.scoreLog10.toFixed(2))+" log10</strong></div>");
 const ti=audit.tacticalInsightLocal;
 const experimental=ti?.enabled===true?
  "<p class='hint'>"+safe(tr(
   "Measured local Tactical Insight calibration: levels {low}–{high}, observed log10 damage gain {damage} and log10 gold gain {gold}. Native A is an interpolation coordinate only; no level outside this interval is eligible.",{
    low:numberText(ti.lowerLevel),high:numberText(ti.upperLevel),
    damage:ti.damageGainLog10.toFixed(3),gold:ti.goldGainLog10.toFixed(3)}))+"</p>":
  audit.tacticalInsightCommunityWeightExcluded===true?
  "<p class='hint'>"+safe(tr("Experimental: the unverified community Tactical Insight coefficient was excluded from this allocation. This is a sensitivity comparison, not evidence of zero in-game benefit or a proven stronger build."))+"</p>":"";
 const comparison=audit.tacticalInsightSensitivity;
 const sensitivity=comparison?.status==="compared-same-model-context"?
  "<p class='hint'>"+safe(tr(
   "Tactical Insight sensitivity: proposed minus current is {community} log10 with the community coefficient, versus {excluded} log10 without that coefficient.",{
    community:comparison.community.proposedMinusCurrentLog10.toFixed(3),
    excluded:comparison.heuristicExcluded.proposedMinusCurrentLog10.toFixed(3)
   }))+"</p>"+
  (comparison.proposedPositiveOnlyWithCommunityCoefficient?
   "<p class='hint'>"+safe(tr(
    "Warning: the proposed allocation only wins under the unverified Tactical Insight coefficient. Compare both trees in the game's Stats panel before applying it."))+"</p>":"")+
  "<p class='hint'>"+safe(tr(
   "This compares two existing trees only, without reoptimizing or predicting stages. Other uncertain skills remain unchanged."))+"</p>":"";
 const alt=result.tacticalInsightAlternative;
 const altView=alt?.status==="explored"?
  "<h4>"+safe(tr("Tactical Insight: alternative SP allocation"))+"</h4>"+
  "<p class='hint'>"+safe(tr(
   "The alternative is optimized with the unverified community Tactical Insight coefficient excluded. It keeps the same SP budget, pets, equipment and constraints; neither allocation is proven better in game."))+"</p>"+
  "<p>"+safe(tr(
   "Alternative minus main build: {excluded} log10 without the TI coefficient; {community} log10 with it. These are proxy-score differences, not stages.",{
    excluded:alt.excludedTI.alternativeMinusOriginalLog10.toFixed(3),
    community:alt.community.alternativeMinusOriginalLog10.toFixed(3)
   }))+"</p>"+
  "<label>"+safe(tr("Alternative build JSON (copy to compare in game)"))+
  "<textarea readonly rows='5' class='export-json' aria-label='Alternative TI build JSON'>"+
  safe(exportBuild(alt.levels))+"</textarea></label>":"";
 const critNotice=Number(result.criticalSourceOnly?.level??0)>0&&
  result.criticalSourceOnly.guaranteedByHeavenlyStrike!==true?
  "<p class='hint'>"+safe(tr("Cleaving Strike critical damage is chance-weighted for non-Heavenly Strike builds using its native talent chance, not guaranteed on every attack. This is a source-only estimate: the account's total critical chance and actual hit eligibility are unverified."))+"</p>":"";
 const jackpotNotice=Number(result.jackpotSourceOnly?.level??0)>0?
  "<p class='hint'>"+safe(tr("Transmutation Jackpot Gold is scored as a source-only chance-weighted gold event, not permanent All Gold. Your account's actual Jackpot chance and event mix are not verified."))+"</p>":"";
 el.innerHTML="<summary>"+safe(tr("Why the proxy invests in these trees"))+
  "</summary><p class='hint'>"+
  safe(tr("Modeled skill contributions only; a high contribution is not proof of real combat power. The comparison does not alter the build."))+
  "</p>"+experimental+sensitivity+jackpotNotice+critNotice+branches.join("")+
  "<h4>"+safe(tr("Largest modeled talent contributions"))+"</h4>"+top.join()+altView;
}
/** Keep both valid builds visible; never invent a damage-to-stage conversion. */
function renderPushSkipComparison(result){
 let el=$("push-skip-comparison");
 if(!el){
  el=document.createElement("details");
  el.id="push-skip-comparison";el.className="result-detail";
  $("model-score-attribution").insertAdjacentElement("afterend",el);
 }
 const compare=result.pushSkipComparison;
 if(!compare||compare.status!=="compared-same-pet-gear-context"){
  el.hidden=true;return;
 }
 el.hidden=false;
 const delta=compare.scoreDifferenceLog10;
 const branches=Object.entries(compare.constrainedBranchTotals).map(([name,after])=>{
  const before=compare.baselineBranchTotals[name]??0;
  const difference=after-before;
  return "<div class='tree-row'><span>"+safe(tr(name))+"</span><strong>"+
   safe(numberText(before))+" → "+safe(numberText(after))+
   " SP ("+(difference>0?"+":"")+safe(numberText(difference))+")</strong></div>";
 });
 el.innerHTML="<summary>"+safe(tr("Stage Skip target: compare two builds"))+
  "</summary><p class='hint'>"+
  safe(tr("The constrained build and the unconstrained build use the same pet/gear context. Their score difference is from the existing damage/gold proxy, not measured boss DPS or stages gained."))+
  "</p><p>"+safe(tr("Source Stage Skip from this talent: {before} → {after}",{
   before:numberText(compare.baselineSourceStageSkip),
   after:numberText(compare.constrainedSourceStageSkip)}))+
  "</p><p>"+safe(tr("Constrained minus baseline proxy score: {delta} log10",{
    delta:(delta>0?"+":"")+delta.toFixed(3)}))+
  "</p>"+branches.join("")+
  "<p class='hint'>"+safe(tr("The comparison uses a bounded SP grid when necessary; neither allocation guarantees a higher stage."))+"</p>"+
  "<label>"+safe(tr("Unconstrained alternative (copy to compare in game)"))+
  "<textarea readonly rows='4' class='export-json' aria-label='Unconstrained alternative'>"+
  safe(exportBuild(compare.baselineLevels))+"</textarea></label>";
}
/** One observed hit from the CURRENT tree only; the recommendation is
 * deliberately shown as source evidence, not as a projected hit value.
 */
function renderBossPushEvidence(result){
 let el=$("boss-push-evidence");
 if(!el){
  el=document.createElement("details");
  el.id="boss-push-evidence";el.className="result-detail";
  $("push-skip-comparison").insertAdjacentElement("afterend",el);
 }
 const current=result.bossPushCurrent,proposed=result.bossPushProposed;
 if(!current||!proposed){el.hidden=true;return;}
 el.hidden=false;
 const fmt=n=>Number(n).toFixed(2);
 const rows=current.channels.map(c=>{
  const suggested=proposed.channels.find(x=>x.id===c.id);
  const source=c.sourceStageSkip.map(x=>x.talent+" +"+x.additionalStageSkip).join(", ");
  const recommended=suggested?.sourceStageSkip.map(x=>x.talent+" +"+x.additionalStageSkip).join(", ")||"—";
  const title=safe(tr(c.label));
  const val=c.observed?.compared===true?
   " · "+safe(tr("Observed single-hit HP margin: {value} log10",{
    value:(c.observed.unmodifiedHpMarginLog10>=0?"+":"")+
     fmt(c.observed.unmodifiedHpMarginLog10)}))+
   " · "+safe(tr({
    "above-unmodified-upper-roll":"Hit exceeds the unmodified +30% HP roll",
    "depends-on-hp-roll":"Hit depends on the unmodified HP roll",
    "below-unmodified-lower-roll":"Hit is below the unmodified -30% HP roll"
   }[c.observed.status]??"Unverified observation")):
   c.observed?" · "+safe(tr("Observed attack cannot be verified for this tree")):"";
  return "<div class='tree-row'><span><strong>"+title+"</strong> · "+
   safe(tr("Current talent"))+" "+safe(numberText(c.sourceTalentLevel))+" · "+
   safe(tr("Proposed talent"))+" "+safe(numberText(suggested?.sourceTalentLevel??0))+
   (source?" · "+safe(tr("Current source Stage Skip"))+": "+safe(source):"")+
   (recommended?" · "+safe(tr("Proposed source Stage Skip"))+": "+safe(recommended):"")+
   val+"</span></div>";
 });
 el.innerHTML="<summary>"+safe(tr("Boss HP and attack channels"))+
 "</summary><p>"+safe(tr("Unmodified boss HP at stage {stage}: 10^{power}",{
  stage:numberText(current.stage),power:fmt(current.unmodifiedBossHpLog10)}))+
 "</p><p class='hint'>"+safe(tr(
 "This panel compares theoretical boss HP and attack-talent Stage Skip sources. It does not measure hit damage or predict stage gains."))+
 "</p>"+rows.join("");
}
/** Optional competing SP allocations; Stage Skip is not a damage score. */
function renderPushFrontier(result){
 let el=$("push-pareto-frontier");
 if(!el){
  el=document.createElement("details");
  el.id="push-pareto-frontier";el.className="result-detail";
  $("boss-push-evidence").insertAdjacentElement("afterend",el);
 }
 const search=result.pushFrontier;
 if(!search){el.hidden=true;return;}
 el.hidden=false;
 if(search.status!=="explored"){
  el.innerHTML="<summary>"+safe(tr("Push alternatives"))+"</summary><p class='hint'>"+
   safe(tr("Alternative allocation search was not available: {reason}",{
    reason:search.reason||search.status}))+"</p>";
  return;
 }
 const rows=search.pareto.map(row=>
  "<div class='tree-row'><div><strong>"+
   safe(tr("Source Stage Skip: {value}",{
    value:numberText(row.sourceStageSkip)}))+
   "</strong> · "+safe(tr("Modeled proxy score: {score} log10",{
    score:row.scoreProxyLog10.toFixed(2)}))+
   " · "+safe(tr("Spent SP: {sp}",{sp:numberText(row.spent)}))+
   "<textarea readonly rows='3' class='export-json' aria-label='"+
   safe(tr("Alternative build export"))+"'>"+
   safe(exportBuild(row.levels))+"</textarea></div></div>").join("");
 const attempts=search.attempted.filter(x=>x.status!=="solved").length;
 el.innerHTML="<summary>"+safe(tr("Push alternatives"))+
  "</summary><p class='hint'>"+
  safe(tr("Source Stage Skip versus the existing skill-score proxy, evaluated for this selected build and final pet/gear setup. These are non-dominated visited alternatives, not predicted stage gains. Extra optimizations are limited."))+
  "</p>"+rows+"<p class='hint'>"+
  safe(tr("Unresolved or infeasible alternatives: {count}",{
   count:numberText(attempts)}))+"</p>";
}
/** Native multiplier vs original score, with no conversion to DPS/stages. */
function renderNativeAttackFrontier(result){
 let el=$("native-attack-frontier");
 if(!el){
  el=document.createElement("details");
  el.id="native-attack-frontier";el.className="result-detail";
  $("push-pareto-frontier").insertAdjacentElement("afterend",el);
 }
 const report=result.attackDamageFrontier;
 if(!report){el.hidden=true;return;}
 el.hidden=false;
 if(report.status!=="explored"){
  el.innerHTML="<summary>"+safe(tr("Attack damage alternatives"))+
   "</summary><p class='hint'>"+safe(tr("Attack comparison unavailable: {reason}",{
    reason:report.reason||report.status}))+"</p>";
  return;
 }
 const rows=report.pareto.map(row=>{
  const value=row.sourceNativeModifierLog10;
  const modifier=value===null?tr("Talent not invested"):
   "10^"+value.toFixed(2);
  return "<div class='tree-row'><div><strong>"+
   safe(tr("Native attack source modifier"))+": "+safe(modifier)+
   "</strong> · "+safe(tr("Talent level"))+" "+safe(numberText(row.sourceSkillLevel))+
   " · "+safe(tr("Modeled proxy score: {score} log10",{
    score:row.scoreProxyLog10.toFixed(2)}))+
   " · "+safe(tr("Spent SP: {sp}",{sp:numberText(row.spent)}))+
   "<textarea readonly rows='3' class='export-json' aria-label='"+
   safe(tr("Alternative build export"))+"'>"+
   safe(exportBuild(row.levels))+"</textarea></div></div>";
 }).join("");
 el.innerHTML="<summary>"+safe(tr("Attack damage alternatives"))+
  "</summary><p class='hint'>"+safe(tr(
   "Experimental comparison of a native multiplier for the selected attack versus the existing damage/gold proxy. These are different full SP allocations under the same pet, gear and account settings. No attack rate, uptime, real boss damage or stage gain has been inferred."))+
  "</p>"+rows+
  (report.nativeSourceNotFurtherImproved?
   "<p class='hint'>"+safe(tr(
    report.alreadyAtNativeSourceMaximum?
     "The selected attack talent is already at its native maximum; no stronger level can be explored.":
     "No stronger native attack level fits the source SP cost. No extra allocation was calculated."))+"</p>":"")+
  (report.attempted.some(x=>x.status.includes("infeasible"))?
   "<p class='hint'>"+safe(tr(
    "Some candidate levels could not meet actual skill-tree prerequisites or other minimums. Their native source cost alone is not enough."))+"</p>":"")+
  "<p class='hint'>"+
  safe(tr("Different full allocations found: {value}",{
   value:report.changedTrees?tr("yes"):tr("no")}))+"</p>";
}
function renderResults(result,scroll=true){
 $("empty-results").hidden=true;$("actual-results").hidden=false;if(scroll)$("results").scrollIntoView({behavior:"smooth",block:"start"});
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
 $("branch-chart").innerHTML=Object.entries(result.branchTotals).map(([name,points])=>`<div class="branch-row"><div class="branch-header"><span>${safe(tr(name))}</span><strong>${numberText(points)} SP</strong></div><div class="progress-track"><div class="progress-fill" style="width:${points/max*100}%;background:${branchColors[name]}"></div></div></div>`).join("");
 renderPetComparisons();renderEquipmentRecommendations();
 renderAccountIntegration(result);
 renderAttackChannelEvidence(result);
 renderModelAttribution(result);
 renderPushSkipComparison(result);
 renderBossPushEvidence(result);
 renderPushFrontier(result);
 renderNativeAttackFrontier(result);
 $("full-tree").innerHTML=Object.entries(BRANCH_NAMES).map(([code,name])=>`<h4 class="group-title">${safe(tr(name))}</h4>`+SKILL_IDS.filter(id=>SKILLS[id].Branch===code&&result.levels[id]>0).map(id=>`<div class="tree-row"><span>${safe(SKILLS[id].Name)}</span><strong>${result.levels[id]}</strong></div>`).join("")).join("");
 $("delta-count").textContent="("+result.changes.length+")";
 $("diff-list").innerHTML=result.changes.length?result.changes.map(change=>`<div class="change-row"><span>${safe(change.name)}</span><span><small>${change.before} → ${change.after}</small> <strong class="${change.difference>=0?"plus":"minus"}">${change.difference>0?"+":""}${change.difference}</strong></span></div>`).join(""):"<p class='hint'>"+safe(tr("No skill-level changes."))+"</p>";
 $("export-json").value=exportBuild(result.levels);
}
function sharePayload(){
 // Local TT2 Stats observations are deliberately NOT placed in a shared URL.
 // A recipient gets the reversible conservative TI exclusion, never
 // a fictitious re-creation of the measured allocation.
 // Compact URL encoding; the exported skill tree itself is intentionally
 // not encrypted. Sharing the link discloses the included game settings.
 return {pushFrontier:state.pushFrontierEnabled===true,attackDamageFrontier:state.attackDamageFrontierEnabled===true,attackDamageChannel:state.attackDamageChannelId,protect:state.protectUnmodeledSkills!==false,co:state.assumeCoordinatedOffensiveActive===true,fz:state.assumeFlashZipAtBoss===true,nm:state.assumeNightmareAtBoss===true,mo:state.assumeMagnumOpusAtBoss===true,tiExperiment:state.excludeUnverifiedTacticalInsight===true||state.tacticalInsightCalibration?.enabled===true,tiMeasurementOmitted:state.tacticalInsightCalibration?.enabled===true,sp:state.skillPoints,st:state.maxStage,da:state.damage,go:state.gold,p:state.playstyle,q:state.qol,w:state.goldWeight,cp:state.craftingPower,tk:state.timeToKill,cl:state.sClone,cur:state.currentLevels,min:state.minimums,exc:state.excluded,keep:state.preserveCurrent,hay:state.assumeHaystActive,snap:state.assumeSnapActive,astral:state.astralActivations,attack:state.pushAttackChannelId,skip:state.pushSourceStageSkipTarget};
}
function decodeLink(){
 const hash=window.location.hash;
 if(!hash.startsWith("#build="))return;
 try{
  const payload=JSON.parse(decodeURIComponent(escape(atob(hash.slice(7)))));
  if(!payload||typeof payload!=="object")return;
  state={...fresh(),skillPoints:payload.sp??0,maxStage:payload.st??0,damage:payload.da??"Clan Ship",gold:payload.go??"Fairy",playstyle:payload.p??"balanced",qol:payload.q??"recommended",goldWeight:payload.w??.7,craftingPower:payload.cp??1,timeToKill:payload.tk??8,sClone:payload.cl??30,currentLevels:payload.cur||{},minimums:payload.min||{},excluded:Array.isArray(payload.exc)?payload.exc:[],preserveCurrent:Boolean(payload.keep),assumeHaystActive:payload.hay===true,
    assumeSnapActive:payload.snap===true,assumeCoordinatedOffensiveActive:payload.co===true,assumeFlashZipAtBoss:payload.fz===true,assumeNightmareAtBoss:payload.nm===true,assumeMagnumOpusAtBoss:payload.mo===true,assumeContractsAtMax:false,astralActivations:payload.astral??0,protectUnmodeledSkills:payload.protect!==false,excludeUnverifiedTacticalInsight:payload.tiExperiment===true,
    pushAttackChannelId:typeof payload.attack==="string"?payload.attack:"",
    pushSourceStageSkipTarget:payload.skip??0,
    pushFrontierEnabled:payload.pushFrontier===true,
    attackDamageFrontierEnabled:payload.attackDamageFrontier===true,
    attackDamageChannelId:typeof payload.attackDamageChannel==="string"?payload.attackDamageChannel:"",mode:"power"};
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
  status(payload.tiMeasurementOmitted===true?
   "Shared build excludes private Tactical Insight measurements. Conservative TI exclusion is enabled.":
   "Shared build settings loaded. Optimize to calculate a new recommendation.","success");
 }catch(e){status("Could not load this shared build link.","error");}
}
function initialize(){
 try{const saved=JSON.parse(localStorage.getItem("tt2_skill_optimizer_v1")||"null");if(saved&&typeof saved==="object")state={...fresh(),...saved};}catch{}
 decodeLink();
 // Retired UI settings from previous sessions must not influence diagnostics.
 delete state.pushObservedAttackChannelId;
 delete state.pushObservedHitDamage;
 delete state.pushBossStage;
 keepContractsConservative(state);
 persist();
 // Old manual toggles or old shared links must never override the export.
 // No completed-set collection means unknown ownership, not zero owned in-game.
 state.sets=ownedSetFlags(state.accountProfile);
 state.mode="power";fillInputs();
 const queryLang=new URL(location.href).searchParams.get("lang");
 const pathLang=document.documentElement.lang;
 let savedLang="en";try{savedLang=localStorage.getItem("tt2_site_language")||"en"}catch{}
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
 $("damage-choices").addEventListener("click",e=>{const b=e.target.closest("[data-damage]");if(b){state.damage=b.dataset.damage;state.tacticalInsightCalibration=null;fillInputs();remember();}});
 $("gold-choices").addEventListener("click",e=>{const b=e.target.closest("[data-gold]");if(b){state.gold=b.dataset.gold;state.tacticalInsightCalibration=null;fillInputs();remember();}});
 $("push-attack-channel").addEventListener("change",()=>{readInputs();remember();});
 $("attack-damage-channel").addEventListener("change",()=>{readInputs();remember();});
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
 for(const id of ["skill-points","max-stage","gold-weight","crafting-power","time-to-kill","clone-level","qol-mode","preserve-current","protect-unmodeled-skills","exclude-unverified-tactical-insight","ti-cal-enabled","coordinated-offensive-active","flash-zip-at-boss","nightmare-at-boss","magnum-opus-at-boss","hayst-active","snap-active","astral-activations","push-stage-skip-target","push-frontier-enabled","attack-damage-frontier-enabled",
  "ti-cal-low-level","ti-cal-high-level","ti-cal-low-damage","ti-cal-high-damage","ti-cal-low-gold","ti-cal-high-gold"])$(id).addEventListener("change",()=>{
  if(id==="ti-cal-enabled"&&$(id).checked)
   $("exclude-unverified-tactical-insight").checked=false;
  if(id==="exclude-unverified-tactical-insight"&&$(id).checked)
   $("ti-cal-enabled").checked=false;
  readInputs();
  remember();
 });
 // Text fields emit "input" before their "change" event (on blur).
 // Cancel a running optimization immediately while the user edits; never
 // accept an old worker result against a half-edited budget or setting.
 for(const id of ["skill-points","max-stage","gold-weight",
  "crafting-power","time-to-kill","clone-level","astral-activations","push-stage-skip-target",
  "ti-cal-low-level","ti-cal-high-level","ti-cal-low-damage","ti-cal-high-damage","ti-cal-low-gold","ti-cal-high-gold"]){
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
