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
export function exactConvolution(a, b, targetBudget = Math.min(a.length,b.length) - 1) {
  // Allow different prefix / branch capacities. An at-most budget above a
  // branch's maximum possible spend is represented by its final score.
  const limit = Math.min(targetBudget,a.length+b.length-2);
  const out = new Float64Array(limit + 1).fill(NEG);
  const split = new Int32Array(limit + 1);
  const minA=a.findIndex(Number.isFinite), minB=b.findIndex(Number.isFinite);
  if(minA<0||minB<0)return {values:out,split};

  // At-most-budget frontiers: entries that do not improve the score cannot
  // participate in a better solution. When the frontier is sparse, enumerate
  // its Pareto points exactly rather than scanning a very loose hull bound.
  // This also makes large, widely-spaced skill costs practical (e.g. 50k).
  const frontier=(arr)=>{
    const points=[];let high=NEG;
    for(let i=0;i<arr.length;i++){
      const val=arr[i];
      if(Number.isFinite(val) && val>high){points.push(i);high=val;}
    }
    return points;
  };
  const fa=frontier(a),fb=frontier(b);
  if(fa.length*fb.length<=1_000_000){
    for(const i of fa)for(const j of fb){
      const k=i+j;
      if(k>limit)break;
      const sum=a[i]+b[j];
      if(sum>out[k]){out[k]=sum;split[k]=i;}
    }
    let top=NEG,chosenI=0;
    for(let k=0;k<=limit;k++){
      if(out[k]>top){top=out[k];chosenI=split[k];}
      else {out[k]=top;split[k]=chosenI;}
    }
    return {values:out,split};
  }
  const aConstant=a.every((v,i)=>i<minA || v===a[minA]);
  const bConstant=b.every((v,i)=>i<minB || v===b[minB]);
  if(aConstant){
    for(let budget=minA+minB;budget<=limit;budget++){
      const chosenA = Math.max(minA,budget-b.length+1);
      out[budget]=a[chosenA]+b[budget-chosenA];split[budget]=chosenA;
    }
    return {values:out,split};
  }
  if(bConstant){
    for(let budget=minA+minB;budget<=limit;budget++){
      const chosenA = Math.min(a.length-1,budget-minB);
      out[budget]=a[chosenA]+b[budget-chosenA];split[budget]=chosenA;
    }
    return {values:out,split};
  }
  const ha = upperConcaveEnvelope(a), hb = upperConcaveEnvelope(b);
  for (let budget = 0; budget <= limit; budget++) {
    const upper = x => ha[x] + hb[budget - x];
    if(budget<minA+minB)continue;
    const minX=Math.max(minA,budget-b.length+1), maxX=Math.min(a.length-1,budget-minB);
    let lo=minX, hi=maxX;
    while (lo<hi) {
      const mid=(lo+hi)>>1;
      if (upper(mid+1)>upper(mid)) lo=mid+1; else hi=mid;
    }
    const peak=lo;
    let best=NEG, bestJ=0;
    for(let d=-1;d<=1;d+=2) {
      let x=d<0?peak:peak+1;
      while(x>=minX&&x<=maxX) {
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
  // The cost capacity of a branch *prefix* is often dramatically lower than
  // the requested budget (especially at 50,000 SP). Store only reachable
  // capacities, not 50,001 slots for every skill in every branch.
  const traces=[];
  let frontier=0;
  let dp=Array.from({length:8},(_,mask)=>Float64Array.of(mask===0?0:NEG));
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
    // A skill that gives exactly zero modeled score cannot improve the
    // objective by overspending after all future branch tier thresholds are
    // satisfied. Keep its 0/positive prerequisite choices, plus the minimum
    // level that reaches the highest remaining SP gate. This is a dominance
    // reduction for the at-most-budget model, not an approximation.
    let effectiveMax=max;
    if(choices.length && choices.every(option=>option.score===0)){
      const lastGate=skills.slice(i+1).reduce((maxGate,item)=>Math.max(maxGate,item.spReq),0);
      const firstGate=choices.find(option=>option.level>0 && option.cost>=lastGate);
      if(firstGate)effectiveMax=Math.max(min,firstGate.level);
      else if(lastGate===0)effectiveMax=Math.max(min,1);
      if(effectiveMax<max){
        while(choices.length && choices[choices.length-1].level>effectiveMax)choices.pop();
      }
    }
    const nextFrontier = Math.min(budget,frontier+skill.costs[effectiveMax]);
    const nextWidth = nextFrontier+1;
    const next=Array.from({length:8},()=>new Float64Array(nextWidth).fill(NEG));
    const prevMask=Array.from({length:8},()=>new Int8Array(nextWidth).fill(-1));
    const choiceLevel=Array.from({length:8},()=>new Int8Array(nextWidth).fill(-1));
    for(let mask=0;mask<8;mask++) {
      const array=dp[mask];
      for(let spent=0;spent<array.length;spent++) {
        const base=array[spent];
        if(!Number.isFinite(base))continue;
        for(const option of choices) {
          if (option.level>0) {
            if(spent<skill.spReq)continue;
            if(distance>0 && (mask & (1 << (distance-1)))===0)continue;
          }
          const sum=spent+option.cost;
          if(sum>nextFrontier)continue;
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
    dp=next;frontier=nextFrontier;
  }
  const width=frontier+1;
  const exact=new Float64Array(width).fill(NEG),endMasks=new Int8Array(width).fill(-1);
  for(let spent=0;spent<width;spent++)for(let mask=0;mask<8;mask++) {
    if(dp[mask][spent]>exact[spent]) {exact[spent]=dp[mask][spent];endMasks[spent]=mask;}
  }
  const atMost=new Float64Array(width).fill(NEG),chosenSpend=new Int32Array(width);
  let best=NEG,choice=0;
  for(let b=0;b<width;b++) {
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
/**
 * Unpruned, exact O(N^2) convolution on reduced grid budgets.
 * Unlike a concave-envelope heuristic, this is a straightforward reference
 * implementation: each possible split is evaluated without approximation.
 */
export function gridConvolutionExact(a,b,targetBudget) {
  const length=Math.min(targetBudget,a.length+b.length-2)+1;
  const values=new Float64Array(length).fill(NEG);
  const split=new Int32Array(length);
  for(let i=0;i<a.length&&i<length;i++){
    if(!Number.isFinite(a[i]))continue;
    for(let j=0;j<b.length&&i+j<length;j++){
      if(!Number.isFinite(b[j]))continue;
      const sum=a[i]+b[j],k=i+j;
      if(sum>values[k]){values[k]=sum;split[k]=i;}
    }
  }
  return {values,split};
}

/**
 * Improve a FEASIBLE coarse-grid solution by moving exact integer SP budgets
 * between already solved branch frontiers. Branch-level DPs are exact;
 * changing their allowed budgets needs no skill re-evaluation or invented
 * coefficient. This monotone local exchange never decreases the candidate
 * score, never exceeds the total budget and never claims global optimality.
 *
 * The rigorous coarse convolution upper bound is retained unchanged.
 */
export function refineBranchCapacities(frontiers,initialCaps,budget,minima=[],{
 radius=40,maxPasses=8
}={}){
 if(!Array.isArray(frontiers)||!Array.isArray(initialCaps)||
    frontiers.length!==initialCaps.length||frontiers.length<1||
    !Number.isSafeInteger(budget)||budget<0||
    !Number.isSafeInteger(radius)||radius<1||radius>512||
    !Number.isSafeInteger(maxPasses)||maxPasses<1||maxPasses>30)
  throw new RangeError("Invalid branch capacity refinement inputs");
 const caps=[...initialCaps],floors=frontiers.map((arr,i)=>
  Number(minima[i]??0));
 let total=0,score=0;
 for(let i=0;i<frontiers.length;i++){
  if(!Number.isSafeInteger(floors[i])||floors[i]<0||
     !Number.isSafeInteger(caps[i])||caps[i]<floors[i]||
     caps[i]>=frontiers[i].length||
     !Number.isFinite(frontiers[i][caps[i]]))
   throw new RangeError("Invalid initial branch capacity");
  total+=caps[i];score+=frontiers[i][caps[i]];
 }
 if(total>budget||!Number.isFinite(score))
  throw new RangeError("Branch capacities exceed SP budget");
 const startScore=score;
 let steps=0,passes=0;
 for(let pass=0;pass<maxPasses;pass++){
  passes++;
  let gain=1e-10,bestMove=null;
  const available=budget-total;
  // A branch's at-most frontier never decreases: test adding all
  // currently unused capacity (or reaching its max) in one step.
  if(available>0)for(let i=0;i<caps.length;i++){
   const next=Math.min(frontiers[i].length-1,caps[i]+available);
   if(next<=caps[i])continue;
   const improvement=frontiers[i][next]-frontiers[i][caps[i]];
   if(Number.isFinite(improvement)&&improvement>gain){
    gain=improvement;bestMove={i,capI:next};
   }
  }
  // Exact per-branch budget exchanges within a bounded neighborhood.
  // A transfer is valid only if BOTH branch states are within their
  // verified frontiers and neither falls below mandatory minimum SP.
  for(let i=0;i<caps.length;i++)for(let j=i+1;j<caps.length;j++)
   for(let shift=-radius;shift<=radius;shift++){
    if(shift===0)continue;
    const ai=caps[i]+shift,bj=caps[j]-shift;
    if(ai<floors[i]||ai>=frontiers[i].length||
       bj<floors[j]||bj>=frontiers[j].length)continue;
    const a=frontiers[i][ai],b=frontiers[j][bj];
    if(!Number.isFinite(a)||!Number.isFinite(b))continue;
    const improvement=a+b-frontiers[i][caps[i]]-frontiers[j][caps[j]];
    if(improvement>gain){
     gain=improvement;bestMove={i,j,capI:ai,capJ:bj};
    }
   }
  if(!bestMove)break;
  const {i,j,capI,capJ}=bestMove;
  total+=capI-caps[i];caps[i]=capI;
  if(j!==undefined){total+=capJ-caps[j];caps[j]=capJ;}
  score+=gain;steps++;
 }
 // Recompute from exact frontiers, never rely on accumulated float drift.
 const recomputed=caps.reduce((sum,cap,i)=>sum+frontiers[i][cap],0);
 if(total>budget||recomputed+1e-7*Math.max(1,Math.abs(startScore))<startScore)
  throw new Error("Branch refinement lost a feasible modeled score");
 return {capacities:caps,score:recomputed,initialScore:startScore,
  gain:Math.max(0,recomputed-startScore),steps,passes,
  totalAllocatedCapacity:total,localExchangeRadius:radius,
  globallyExact:false};
}

export function optimizeExact(skills, budget, scoreFor, _retiredMode="power", onProgress=()=>{}, {gridThreshold=12000,gridTarget=2500,branchCache=null}={}) {
  if (!Number.isInteger(budget)||budget<0||budget>50000) throw new Error("SP budget must be from 0 to 50,000.");
  const groups=[];
  for(const skill of skills){
    let group=groups.find(g=>g.branch===skill.branch);
    if(!group){group={branch:skill.branch,skills:[]};groups.push(group)}
    group.skills.push(skill);
  }
  const branchSolutions=[];
  for(let i=0;i<groups.length;i++){
    const group=groups[i];
    const maxBranchSpend=group.skills.reduce((sum,skill)=>sum+skill.costs[skill.excluded?skill.min:skill.max],0);
    const budgetForBranch=Math.min(budget,maxBranchSpend);
    let solution=null;
    if(branchCache instanceof Map){
      // A cache entry is reusable iff the complete branch objective and
      // constraints are identical. A different pet affecting Combat
      // Techniques invalidates Summoner only; unrelated branches are reused.
      const signature=JSON.stringify([budgetForBranch,group.skills.map(skill=>[
        skill.id,skill.min,skill.max,skill.excluded,skill.spReq,skill.parent,
        skill.costs,Array.from({length:skill.max+1},(_,lvl)=>scoreFor(skill,lvl))
      ])]);
      const saved=branchCache.get(group.branch);
      if(saved?.signature===signature)solution=saved.solution;
      else{
        solution=branchDynamicProgram(group.skills,budgetForBranch,scoreFor);
        branchCache.set(group.branch,{signature,solution});
      }
    }else solution=branchDynamicProgram(group.skills,budgetForBranch,scoreFor);
    branchSolutions.push(solution);
    onProgress({phase:"skills",completed:i+1,total:groups.length});
  }
  // Exact cross-branch convolution has quadratic worst-case cost. Above
  // 12k SP, solve each branch EXACTLY at native SP resolution, then combine
  // them on a 2,500-point coarse grid. This is a bounded approximation.
  // A feasible grid allocation is a LOWER bound on the exact optimum. By
  // rounding each true branch budget UP by q, the exact optimum is at most
  // the grid optimum for budget floor(B/q)+branchCount. That is a rigorous
  // UPPER bound for the additive score model.
  const gridded=budget>gridThreshold;
  const floorCosts=groups.map(g=>g.skills.reduce((sum,skill)=>sum+skill.costs[skill.min||0],0));
  const floorTotal=floorCosts.reduce((sum,x)=>sum+x,0);
  if(floorTotal>budget)throw new Error("Required minimum levels exceed your SP budget.");
  // Work on ADDITIONAL points after mandatory minimums, making every coarse
  // candidate feasible even when minimums use almost the entire SP budget.
  const freeBudget=budget-floorTotal;
  const quantum=gridded?Math.max(1,Math.ceil(freeBudget/gridTarget)):1;
  const lowerGridBudget=gridded?Math.floor(freeBudget/quantum):budget;
  const highGridBudget=lowerGridBudget+(gridded?branchSolutions.length:0);
  const steps=[];
  let global=Float64Array.of(0);
  for(let i=0;i<branchSolutions.length;i++){
    const full=branchSolutions[i].values;
    const values=gridded
      ? Float64Array.from({length:Math.ceil(freeBudget/quantum)+1},(_,k)=>full[Math.min(floorCosts[i]+k*quantum,full.length-1)])
      : full;
    const merged=gridded
      ? gridConvolutionExact(global,values,highGridBudget)
      : exactConvolution(global,values,budget);
    steps.push(merged);
    global=merged.values;
    onProgress({phase:"combine",completed:i+1,total:branchSolutions.length});
  }
  let selectedBudget=Math.min(lowerGridBudget,global.length-1);
  const scoreAtFullBudget=global[selectedBudget];
  const boundAt=Math.min(highGridBudget,global.length-1);
  const upperBound=global[boundAt];
  if(!Number.isFinite(global[selectedBudget]))throw new Error("No valid allocation fits these settings. Check QoL and minimums.");
  const capacities=new Array(branchSolutions.length);
  let b=selectedBudget;
  for(let i=branchSolutions.length-1;i>=0;i--) {
    const branchBudget=b-steps[i].split[b];
    const physicalBudget=gridded?floorCosts[i]+branchBudget*quantum:branchBudget;
    capacities[i]=Math.min(physicalBudget,branchSolutions[i].values.length-1);
    b=steps[i].split[b];
  }
  const refined=gridded?refineBranchCapacities(
   branchSolutions.map(x=>x.values),capacities,budget,floorCosts,
   {radius:Math.min(512,Math.max(4,quantum*4)),maxPasses:8}):
   null;
  const chosenCapacities=refined?.capacities??capacities;
  const levels={};
  for(let i=0;i<branchSolutions.length;i++)
   Object.assign(levels,branchSolutions[i].reconstruct(chosenCapacities[i]));
  const score=refined?.score??global[selectedBudget];
  if(score>upperBound+1e-8)
   throw new Error("Refined score exceeds the certified coarse-grid upper bound");
  return {
    levels,score,
    solver:gridded?"bounded-grid-dp":"exact-dp",
    capacity:gridded?refined.totalAllocatedCapacity:selectedBudget,
    optimality:gridded?{
      mode:"bounded-power",
      quantum,lowerBound:score,upperBound,
      initialLowerBound:scoreAtFullBudget,
      localRefinement:{gain:refined.gain,steps:refined.steps,
       passes:refined.passes,radius:refined.localExchangeRadius},
      gap:Math.max(0,upperBound-score),
      certifiedExact:Math.abs(upperBound-score)<1e-8
    }:{mode:"exact",certifiedExact:true,quantum:1,lowerBound:score,upperBound:score,gap:0}
  };
}
