/**
 * Flash Zip cooldown affects frequency, NOT per-activation damage.
 * No undocumented cadence receives a modeled bonus.
 */
export function activationCountInWindow(windowSeconds,baseCooldownSeconds,multiplier=1){
 if(!Number.isFinite(windowSeconds)||windowSeconds<0||
  !Number.isFinite(baseCooldownSeconds)||baseCooldownSeconds<=0||
  !Number.isFinite(multiplier)||multiplier<=0)return null;
 const interval=baseCooldownSeconds*multiplier;
 if(!Number.isFinite(interval)||interval<=0)return null;
 const ratio=windowSeconds/interval;
 if(!Number.isFinite(ratio)||ratio>Number.MAX_SAFE_INTEGER-1)
  return null;
 return 1+Math.floor(ratio);
}
export function cooldownFrequencyGainLog10(multiplier,settings={},source="flashZip"){
 if(settings[source+"WindowSeconds"]==null||
    settings[source+"BaseCooldownSeconds"]==null)return 0;
 const window=Number(settings[source+"WindowSeconds"]);
 const base=Number(settings[source+"BaseCooldownSeconds"]);
 const before=activationCountInWindow(window,base,1);
 const after=activationCountInWindow(window,base,Number(multiplier));
 // Source-only relative opportunity count. NEVER add this to per-hit
 // damage; repeated successful hits are not implied by cooldowns.
 return before!==null&&after!==null?
  Math.log10(Math.max(1,after/before)):0;
}
