/**
 * Exact maximization of a separable fixed-CT gear objective with at most
 * one dependency: Aura may reference Sword, Helmet or Slash.
 * All other slot contributions are independent. Do not use this for an
 * objective with arbitrary equipment set synergies or coupled SP levels.
 */
const ORDER=["Armor","Sword","Helmet","Slash","Aura"];
export function factorizedGearSearch(options,scoreSlot,linkedTarget){
 const independent=ORDER.slice(0,-1);
 let slotEvaluations=0,examinedConfigurations=0;
 const evaluate=(item,gear)=>{slotEvaluations++;const v=scoreSlot(item,gear);
  if(!Number.isFinite(v))throw new Error("Nonfinite gear factor score");return v;};
 const ranked=Object.fromEntries(independent.map(slot=>[slot,
  options[slot].map((item,index)=>({item,index,score:evaluate(item,{})}))]));
 const maxima=Object.fromEntries(independent.map(slot=>[slot,
  ranked[slot].reduce((best,row)=>row.score>best.score?row:best)]));
 let best=null;
 const earlier=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i];}return false;};
 for(let index=0;index<options.Aura.length;index++){
  const aura=options.Aura[index],target=linkedTarget(aura);
  if(target!==null&&!independent.includes(target))throw new Error("Unsupported gear dependency");
  for(const candidate of target?ranked[target]:[null]){
   const rows={...maxima,...(target?{[target]:candidate}:{})};
   const selected=Object.fromEntries(independent.map(slot=>[slot,rows[slot].item]));
   selected.Aura=aura;
   const total=independent.reduce((sum,slot)=>sum+rows[slot].score,0)+evaluate(aura,selected);
   const indices=[...independent.map(slot=>rows[slot].index),index];
   examinedConfigurations++;
   if(!best||total>best.score||(total===best.score&&earlier(indices,best.indices)))
    best={selected,score:total,indices};
  }
 }
 return {...best,examinedConfigurations,slotEvaluations};
}
