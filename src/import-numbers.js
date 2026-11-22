/** Strict import counters; absent and explicit zero are distinct. */
export function parseExportCounter(value,name="Counter"){
 if(value===undefined||value===null||value==="")return null;
 if(typeof value==="number"){
  if(!Number.isSafeInteger(value)||value<0)throw new RangeError("Invalid "+name+": expected a non-negative integer");
  return value;
 }
 if(typeof value!=="string")throw new TypeError("Invalid "+name+": expected an integer");
 const raw=value.trim().replace(/[\u00a0\u202f]/g," ");
 if(!raw)return null;
 if(!/^\d+$/.test(raw)&&!/^\d{1,3}(?:,\d{3})+$/.test(raw)&&
    !/^\d{1,3}(?: \d{3})+$/.test(raw))
  throw new RangeError("Ambiguous or invalid "+name+" integer: "+raw.slice(0,40));
 const n=Number(raw.replace(/[ ,]/g,""));
 if(!Number.isSafeInteger(n)||n<0)throw new RangeError("Invalid "+name+": outside safe integer range");
 return n;
}
