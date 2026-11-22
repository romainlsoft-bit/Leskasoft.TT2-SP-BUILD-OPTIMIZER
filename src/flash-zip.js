/**
 * Flash Zip cooldown affects frequency, NOT per-activation damage.
 * No undocumented cadence receives a modeled bonus.
 */
export function activationCountInWindow(windowSeconds,baseCooldownSeconds,multiplier=1){
 if(!Number.isFinite(windowSeconds)||windowSeconds<0||
  !Number.isFinite(baseCooldownSeconds)||baseCooldownSeconds<=0||
  !Number.isFinite(multiplier)||multiplier<=0)return null;
 return 1+Math.floor((windowSeconds+1e-10)/(baseCooldownSeconds*multiplier));
}
export function cooldownFrequencyGainLog10(multiplier,settings={},source="flashZip"){
 if(settings[source+"WindowSeconds"]==null||
    settings[source+"BaseCooldownSeconds"]==null)return 0;
 const window=Number(settings[source+"WindowSeconds"]);
 const base=Number(settings[source+"BaseCooldownSeconds"]);
 const before=activationCountInWindow(window,base,1);
 const after=activationCountInWindow(window,base,Number(multiplier));
 return before&&after?Math.log10(Math.max(1,after/before)):0;
}
