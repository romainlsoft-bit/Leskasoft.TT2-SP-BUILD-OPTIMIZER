/**
 * Exact skill-tree optimizer for a *specified scoring model*.
 * Replaces heuristic pruning of intermediate skill-point states with an
 * integer-budget dynamic program. Requirements are read from skill data,
 * not hard-coded skill indices. All states remain available for tier unlocks.
 * Cross-branch max-plus convolution uses a concave upper envelope ONLY as a
 * provable bound; candidates are evaluated with real scores.
 *
 * No guarantee is made that the game's real-world progression rate is
 * captured by the score function supplied by the caller.
 */
const NEG = Number.NEGATIVE_INFINITY;
const EPS = 1e-8;

export function upperConcaveEnvelope(values) {
  const hull = [];
  for (let x = 0; x < values.length; x++) {
    const y = values[x];
    if (!Number.isFinite(y)) continue;
    while (hull.length >= 2) {
      const a = hull[hull.length - 2], b = hull[hull.length - 1];
      if ((values[b] - values[a]) * (x - b) > (y - values[b]) * (b - a)) break;
      hull.pop();
    }
    hull.push(x);
  }
  const out = new Float64Array(values.length).fill(NEG);
  if (!hull.length) return out;
  for (let i = 0; i < hull.length - 1; i++) {
    const a = hull[i], b = hull[i + 1];
    for (let x = a; x <= b; x++)
      out[x] = values[a] + (values[b] - values[a]) * (x - a) / (b - a);
  }
  for (const x of hull) out[x] = Math.max(out[x], values[x]);
  return out;
}

/**
 * Max-plus convolution for nondecreasing, finite at-most-budget arrays.
 * Concave envelopes are upper bounds and never replace a real candidate.
 * Exactness is independently tested against O(B²) reference code.
 */
export function exactConvolution(a, b) {
  const limit = Math.min(a.length,b.length) - 1;
  const out = new Float64Array(limit + 1).fill(NEG);
  const split = new Int32Array(limit + 1);
  const minA=a.findIndex(Number.isFinite), minB=b.findIndex(Number.isFinite);
  if(minA<0||minB<0)return {values:out,split};
  const aConstant=a.every((v,i)=>i<minA || v===a[minA]);
  const bConstant=b.every((v,i)=>i<minB || v===b[minB]);
  if(aConstant){
    for(let budget=minA+minB;budget<=limit;budget++){out[budget]=a[minA]+b[budget-minA];split[budget]=minA;}
    return {values:out,split};
  }
  if(bConstant){
    for(let budget=minA+minB;budget<=limit;budget++){out[budget]=a[budget-minB]+b[minB];split[budget]=budget-minB;}
    return {values:out,split};
  }
  const ha = upperConcaveEnvelope(a), hb = upperConcaveEnvelope(b);
  for (let budget = 0; budget <= limit; budget++) {
    const upper = x => ha[x] + hb[budget - x];
    if(budget<minA+minB)continue;
    let lo=minA, hi=budget-minB;
    while (lo<hi) {
      const mid=(lo+hi)>>1;
      if (upper(mid+1)>upper(mid)) lo=mid+1; else hi=mid;
    }
    const peak=lo;
    let best=NEG, bestJ=0;
    for(let d=-1;d<=1;d+=2) {
      let x=d<0?peak:peak+1;
      while(x>=minA&&x<=budget-minB) {
        if(Number.isFinite(best) && upper(x)<best-EPS*(1+Math.abs(best))) break;
        const score=a[x]+b[budget-x];
        if(score>best+1e-10 || (Math.abs(score-best)<=1e-10 && x<bestJ)){best=score;bestJ=x;}
        x+=d;
      }
    }
    out[budget]=best;
    split[budget]=bestJ;
  }
  return {values:out,split};
}

export function branchDynamicProgram(skills, budget, scoreFor) {
  if (!Number.isInteger(budget)||budget<0) throw new Error("Invalid skill-point budget.");
  const width=budget+1;
  const traces=[];
  let dp=Array.from({length:8},()=>new Float64Array(width).fill(NEG));
  dp[0][0]=0;
  const byId=new Map(skills.map((skill,i)=>[skill.id,i]));
  for (let i=0;i<skills.length;i++) {
    const skill=skills[i], parentIndex=byId.get(skill.parent);
    const distance=skill.parent && skill.parent!=="None" ? i-parentIndex : 0;
    if (distance<0||distance>3||skill.parent!=="None" && distance===0)
      throw new Error("Unsupported prerequisite ordering for "+skill.id);
    const min=Math.max(0,skill.min||0);
    const max=Math.min(skill.max,skill.excluded?min:skill.max);
    if(min>max)throw new Error("Impossible minimum for "+skill.id);
    const choices=[];
    for(let level=min;level<=max;level++) {
      const cost=skill.costs[level];
      if(!Number.isSafeInteger(cost)||cost<0)throw new Error("Invalid SP cost for "+skill.id);
      if(cost<=budget){ const score=level ? scoreFor(skill,level):0;
        if(!Number.isFinite(score))throw new Error("Non-finite score for "+skill.id+" level "+level);
        choices.push({level,cost,score}); }
    }
    const next=Array.from({length:8},()=>new Float64Array(width).fill(NEG));
    const prevMask=Array.from({length:8},()=>new Int8Array(width).fill(-1));
    const choiceLevel=Array.from({length:8},()=>new Int8Array(width).fill(-1));
    for(let mask=0;mask<8;mask++) {
      const array=dp[mask];
      for(let spent=0;spent<=budget;spent++) {
        const base=array[spent];
        if(!Number.isFinite(base))continue;
        for(const option of choices) {
          if (option.level>0) {
            if(spent<skill.spReq)continue;
            if(distance>0 && (mask & (1 << (distance-1)))===0)continue;
          }
          const sum=spent+option.cost;
          if(sum>budget)continue;
          const nmask=((mask<<1)|(option.level>0?1:0))&7;
          const total=base+option.score;
          if(total>next[nmask][sum]+1e-10) {
            next[nmask][sum]=total;
            prevMask[nmask][sum]=mask;
            choiceLevel[nmask][sum]=option.level;
          }
        }
      }
    }
    traces.push({prevMask,choiceLevel});
    dp=next;
  }
  const exact=new Float64Array(width).fill(NEG),endMasks=new Int8Array(width).fill(-1);
  for(let spent=0;spent<=budget;spent++)for(let mask=0;mask<8;mask++) {
    if(dp[mask][spent]>exact[spent]) {exact[spent]=dp[mask][spent];endMasks[spent]=mask;}
  }
  const atMost=new Float64Array(width).fill(NEG),chosenSpend=new Int32Array(width);
  let best=NEG,choice=0;
  for(let b=0;b<=budget;b++) {
    if(exact[b]>best+1e-10){best=exact[b];choice=b;}
    atMost[b]=best; chosenSpend[b]=choice;
  }
  return {values:atMost, exact, spentAt:chosenSpend, reconstruct(allowedBudget){
    let spent=chosenSpend[allowedBudget],mask=endMasks[spent];
    if(mask<0)throw new Error("No feasible allocation for branch.");
    const levels={};
    for(let i=skills.length-1;i>=0;i--){
      const step=traces[i], level=step.choiceLevel[mask][spent];
      if(level<0)throw new Error("Backtracking failed for "+skills[i].id);
      levels[skills[i].id]=level;
      const prev=step.prevMask[mask][spent];
      spent-=skills[i].costs[level]; mask=prev;
    }
    return levels;
  }};
}

/**
 * All branches are independent for skill-tree eligibility. Cross-branch
 * effect synergies are approximated by the caller's score model.
 */
export function optimizeExact(skills, budget, scoreFor, mode="power") {
  if (!Number.isInteger(budget)||budget<0||budget>25000) throw new Error("SP budget must be from 0 to 25,000.");
  const groups=[];
  for(const skill of skills){
    let group=groups.find(g=>g.branch===skill.branch);
    if(!group){group={branch:skill.branch,skills:[]};groups.push(group)}
    group.skills.push(skill);
  }
  const branchSolutions=groups.map(g=>branchDynamicProgram(g.skills,budget,scoreFor));
  const steps=[];
  let global=new Float64Array(budget+1).fill(0);
  for(const branch of branchSolutions){
    const merged=exactConvolution(global,branch.values);
    steps.push(merged);
    global=merged.values;
  }
  let selectedBudget=budget;
  if(mode==="efficiency"){
    const floorExpense=skills.reduce((sum,s)=>sum+s.costs[s.min||0],0);
    let rate=NEG;
    for(let b=floorExpense+1;b<=budget;b++){
      if(!Number.isFinite(global[b]))continue;
      const current=global[b]/(b-floorExpense);
      if(current>rate){rate=current;selectedBudget=b;}
    }
  }
  if(!Number.isFinite(global[selectedBudget]))throw new Error("No valid allocation fits these settings. Check QoL and minimums.");
  const levels={};
  let b=selectedBudget;
  for(let i=branchSolutions.length-1;i>=0;i--) {
    const branchBudget=b-steps[i].split[b];
    Object.assign(levels,branchSolutions[i].reconstruct(branchBudget));
    b=steps[i].split[b];
  }
  return {levels,score:global[selectedBudget],solver:"exact-dp",capacity:selectedBudget};
}
