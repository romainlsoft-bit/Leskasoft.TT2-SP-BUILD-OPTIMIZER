/** Optional final-candidate diagnostics. The caller injects the cached solver. */
import {proposeContractScenarioBuild} from "./contract-multi-scenarios.js?v=20261123-boss-specials-r1";
import {explorePushParetoFrontier} from "./push-frontier.js?v=20261123-boss-specials-r1";
import {exploreNativeAttackDamageFrontier} from "./attack-damage-frontier.js?v=20261123-boss-specials-r1";
import {exploreTacticalInsightAlternative} from "./ti-alternative.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&alt=20261123-ti-second-tree-r1&dimensional=20261127-r1&poisonsprout=20261127-r1&proccoupling=20261127-r1";
import {calculateModeledScenario} from "./calculation-ledger.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";

export function createFinalCandidateDecision(settings,solve){
  // Compare the forced Stage Skip target to an unconstrained solve
  // under the SAME final pet/gear context. This is run ONCE for the
  // winner, not once per pet candidate. Report TWO feasible allocations
  // and their old proxy scores; Stage Skip is never assigned a made-up
  // log10 damage weight.
  const withPushComparison=(choice,selected)=>{
   const target=selected?.pushSkipTarget;
   if(target?.enabled!==true)return selected;
   if(choice.context?.contractMultiScenario?.enabled===true)
    return {...selected,pushSkipComparison:{status:"not-comparable-with-contract-scenario"}};
   const unforced=solve({...choice.context,
    pushAttackChannelId:"",pushSourceStageSkipTarget:0});
   const source=target.sourceSkillId,col=target.sourceColumn;
   const sourceBefore=Number(
    // Use the same source-row values already audited by the engine.
    // No Stage Skip from equipment, sets or global stats is inferred.
    unforced.attackChannels.channels.find(c=>c.id===target.attackChannelId)
     ?.skip.find(x=>x.skillId===source&&x.kind==="stage")?.value??0
   );
   return {...selected,pushSkipComparison:{
    schema:"tt2-source-skip-proxy-comparison-v1",
    status:"compared-same-pet-gear-context",
    attackChannelId:target.attackChannelId,
    sourceSkillId:source,sourceColumn:col,
    baselineScore:unforced.score,constrainedScore:selected.score,
    scoreDifferenceLog10:selected.score-unforced.score,
    baselineSourceStageSkip:sourceBefore,
    constrainedSourceStageSkip:target.actualSourceStageSkip,
    baselineBranchTotals:unforced.branchTotals,
    constrainedBranchTotals:selected.branchTotals,
    baselineLevels:unforced.levels,
    baselineSP:unforced.spent,constrainedSP:selected.spent,
    sameRequestedPetGearContext:true,
    boundedGridMayChangeExactOrdering:
     unforced.optimality?.certifiedExact!==true||
     selected.optimality?.certifiedExact!==true,
    comparesModeledSPProxyOnly:true,
    scoreIsNotMeasuredCombatDps:true,stageGainPredicted:false
   }};
  };
  // Optional, bounded Pareto alternatives are solved only once after
  // choosing the real winning pet + gear context. The legacy winner and
  // all observed boss damage remain untouched; additional trees are
  // explicitly hypothetical and receive no copied measured hit.
  const withPushFrontier=(choice,result)=>{
   const context=choice.context||settings;
   if(context.pushFrontierEnabled!==true&&
      context.attackDamageFrontierEnabled!==true)return result;
   const fixed={...context,pushObservedAttackChannelId:null,
    pushObservedHitDamage:null};
   let extended=result;
   if(context.pushFrontierEnabled===true){
    const alternate=explorePushParetoFrontier(fixed,{
     maxConstrained:2,
     baselineResult:result.pushSkipTarget?.enabled===false?result:null,
     solve:opts=>solve(opts)
    });
    extended={...extended,pushFrontier:alternate};
   }
   // Same final pets/gear and SP budget, no duplicated full equipment search.
   // Each native modifier is compared for ONE attack, never converted to DPS.
   if(context.attackDamageFrontierEnabled===true){
    const sourceAlternatives=exploreNativeAttackDamageFrontier(fixed,{
     maxConstrained:2,baselineResult:result,
     solve:opts=>solve(opts)
    });
    extended={...extended,attackDamageFrontier:sourceAlternatives};
   }
   return extended;
  };
  // At most ONE additional SP solve after the final pet/gear choice,
  // and only when the preceding TI audit finds a fragile ranking.
  // Never rerun pet or gear search for the alternative.
  const withTIAlternative=(choice,result)=>{
   const context=choice.context||settings;
   const report=exploreTacticalInsightAlternative(context,result,{
    solve:opts=>solve(opts)
   });
   return {...result,tacticalInsightAlternative:report};
  };
  // Optional explicit scenario comparison only for the final chosen
  // pet/gear pair. Do NOT multiply the whole gear/pet search workload.
  const withContractDecision=choice=>{
   const context=choice.context||settings;
   if(context.contractMultiScenario?.enabled!==true)
    return withTIAlternative(choice,
     withPushFrontier(choice,withPushComparison(choice,choice.result)));
   const selection=proposeContractScenarioBuild({
    settings:context,baseline:choice.result,gearSelection:choice.gearSelection,
    solve:opts=>solve(opts),
    score:(result,opts,gear)=>
     calculateModeledScenario(result,opts,gear).totalLog10
   });
   // On unresolved or infeasible inputs, preserve the EXACT original
   // modeled result, including its score and existing maximum-mode choice.
   if(selection.selection.status!=="ranked")
    return withTIAlternative(choice,
      withPushFrontier(choice,withPushComparison(choice,
       {...choice.result,contractMultiScenario:selection.selection})));
   const winner=selection.result;
   // The returned result uses the conservative DP objective (the contract
   // source-only window gain never becomes an always-on skill multiplier).
   const modeledScenario=calculateModeledScenario(winner,{
    ...context,assumeContractsAtMax:false},choice.gearSelection);
   return withTIAlternative(choice,
     withPushFrontier(choice,withPushComparison(choice,
      {...winner,modeledScenario,contractMultiScenario:selection.selection})));
  };
  return withContractDecision;
}
