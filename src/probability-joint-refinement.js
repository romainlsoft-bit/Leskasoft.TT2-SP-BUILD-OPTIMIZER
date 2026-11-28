/** Bounded local comparison on the same additive skill scores plus only
 * the previously uncredited source probability interaction. No new DP.
 * The main additive optimum and its certificate remain untouched. */
export const PROBABILITY_PARTNERS=Object.freeze(["HeavyStrikes","Transmutation","MultiMonsters","LovePotion","LoadedDice"]);
const partnerSet=new Set(PROBABILITY_PARTNERS);
const MAX_PASSES=4;
const TOL=1e-8;
export function isFeasibleSkillAllocation(skills,levels,budget){
 const prefixes=new Map(),unlocked=new Set();
 let total=0;
 for(const skill of skills){
  const n=levels[skill.id],max=skill.excluded?skill.min:skill.max;
  if(!Number.isSafeInteger(n)||n<skill.min||n>max)return false;
  const cost=skill.costs[n],prefix=prefixes.get(skill.branch)??0;
  if(!Number.isSafeInteger(cost)||cost<0)return false;
  if(n>0&&(prefix<skill.spReq||
   (skill.parent&&skill.parent!=="None"&&!unlocked.has(skill.parent))))return false;
  if(n>0)unlocked.add(skill.id);
  total+=cost;
  if(total>budget)return false;
  prefixes.set(skill.branch,prefix+cost);
 }
 return true;
}
export function refineProbabilityAllocation({skills,budget,levels,scoreFor,residualFor}){
 const initial={...levels};
 if(!isFeasibleSkillAllocation(skills,initial,budget))
  throw new Error("Invalid starting allocation for probability refinement");
 const score=(skill,n)=>n===0?0:scoreFor(skill,n);
 const sum=(tree)=>skills.reduce((s,k)=>s+score(k,tree[k.id]),0);
 const spend=(tree)=>skills.reduce((s,k)=>s+k.costs[tree[k.id]],0);
 const cache=new Map();
 // The residual depends ONLY on these five coordinates. Avoid copying
 // the full 72-skill tree for every candidate (most are rejected).
 const residual=(tree,a=null,na=0,b=null,nb=0)=>{
  const coordinates=PROBABILITY_PARTNERS.map(id=>
   id===a?.id?na:id===b?.id?nb:tree[id]??0);
  const key=coordinates.join("/");
  if(!cache.has(key)){
   const value=residualFor(Object.fromEntries(PROBABILITY_PARTNERS.map((id,i)=>[id,coordinates[i]])));
   if(!Number.isFinite(value)||value<0)throw new Error("Invalid probability residual");
   cache.set(key,value);
  }
  return cache.get(key);
 };
 const partners=skills.filter(k=>partnerSet.has(k.id));
 const originalAdditive=sum(initial),originalResidual=residual(initial);
 let best=initial,additive=originalAdditive,correction=originalResidual,
  spent=spend(initial),moves=0,evaluated=0,stationary=false;
 for(let pass=0;pass<MAX_PASSES;pass++){
  let selected=null;
  const consider=(a,na,b=null,nb=0)=>{
   const la=best[a.id],lb=b?best[b.id]:0;
   if(na<a.min||na>(a.excluded?a.min:a.max)||na===la)return;
   if(b&&(nb<b.min||nb>(b.excluded?b.min:b.max)||nb===lb))return;
   const cost=spent+a.costs[na]-a.costs[la]+(b?b.costs[nb]-b.costs[lb]:0);
   if(cost>budget)return;
   const v=additive+score(a,na)-score(a,la)+(b?score(b,nb)-score(b,lb):0);
   const extra=residual(best,a,na,b,nb),joint=v+extra;
   evaluated++;
   if(joint<=(selected?.joint??(additive+correction))+TOL)return;
   const trial={...best,[a.id]:na};
   if(b)trial[b.id]=nb;
   if(!isFeasibleSkillAllocation(skills,trial,budget))return;
   selected={trial,joint,v,extra,cost};
  };
  for(const a of partners){
   for(const direction of [-1,1]){
    const na=best[a.id]+direction;
    if(na<a.min||na>(a.excluded?a.min:a.max))continue;
    consider(a,na);
    for(const b of skills){
     if(a===b)continue;
     // Both increments can uncover an interaction missed at zero floors.
     for(const db of [-1,1])consider(a,na,b,best[b.id]+db);
     // A more expensive partner upgrade may require several donor levels.
     // Try only the smallest reduction that funds it, not every combination.
     if(direction===1){
      const need=spent+a.costs[na]-a.costs[best[a.id]]-budget;
      if(need>0){
       let nb=best[b.id]-1;
       while(nb>=b.min&&b.costs[best[b.id]]-b.costs[nb]<need)nb--;
       if(nb<best[b.id]-1&&nb>=b.min)consider(a,na,b,nb);
      }
     }
    }
   }
  }
  if(!selected){stationary=true;break;}
  best=selected.trial;additive=selected.v;correction=selected.extra;
  spent=selected.cost;moves++;
 }
 // Recompute exact candidate totals once, rather than expose accumulated
 // floating point deltas or the additive certificate as a joint bound.
 additive=sum(best);correction=residual(best);
 const gain=additive+correction-originalAdditive-originalResidual;
 const improved=moves>0&&gain>TOL;
 return {schema:"tt2-local-probability-joint-alternative-v1",
  status:improved?"improved":"no-improvement-in-tested-neighborhood",
  ...(improved?{levels:best}:{}),budget,spent:improved?spent:spend(initial),
  originalAdditiveLog10:originalAdditive,originalResidualLog10:originalResidual,
  alternativeAdditiveLog10:improved?additive:originalAdditive,
  alternativeResidualLog10:improved?correction:originalResidual,
  gainLog10:improved?gain:0,moves,evaluated,residualEvaluations:cache.size,
  maxPasses:MAX_PASSES,stationary,globallyExact:false,
  appliedToRecommendation:false,sourceOnly:true,realStageGainPredicted:false};
}
