const checks = [
  { key:'mrp', label:'Maximum Retail Price (MRP)', ruleRef:'Rule 6', test:v=>/\b(?:MRP|Maximum Retail Price)\s*(?:Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?/i.test(v||''), missing:'MRP is missing or could not be recognized.' },
  { key:'netQuantity', label:'Net quantity', ruleRef:'Rule 6', test:v=>/\bnet\s*(?:quantity|qty|wt\.?|weight)?\s*[:\-]?\s*\d+(?:\.\d+)?\s*(?:mg|g|kg|ml|l|nos?\.?|pcs?\.?|pieces?)\b/i.test(v||''), missing:'Net quantity or a recognizable standard unit is missing.' },
  { key:'manufactureDate', label:'Month and year', ruleRef:'Rule 6', test:v=>/(?:packed|manufactur(?:ed|e)|mfg|import(?:ed|ing)?).{0,25}(?:\b(?:0?[1-9]|1[0-2])\s*[\/-]\s*\d{4}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*\d{4}\b)/i.test(v||''), missing:'Manufacture/packing/import month and year is missing or unclear.' },
  { key:'manufacturer', label:'Manufacturer / packer / importer', ruleRef:'Rule 6', test:v=>Boolean((v||'').trim().length >= 15), missing:'Manufacturer/packer/importer details appear incomplete.' },
  { key:'consumerCare', label:'Consumer care details', ruleRef:'Rule 6', test:v=>/(?:\+91[-\s]?)?[6-9]\d{9}|\b\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,4}\b/i.test(v||'') || /@/.test(v||''), missing:'A recognizable consumer-care phone or email was not found.' },
  { key:'bestBefore', label:'Best before / use by / expiry', ruleRef:'Rule 6', test:v=>/(?:best\s*before|use\s*by|expiry|expires?)/i.test(v||''), missing:'Best-before/use-by/expiry information is missing.' }
];
export function evaluateCompliance(data){
  const results = checks.map(c=>{const value=data[c.key]||''; const valid=c.test(value); return {field:c.key,label:c.label,present:Boolean(value.trim()),valid,extractedText:value,ruleRef:c.ruleRef,violation:!valid,violationMessage:valid?'':c.missing};});
  if(data.imported === 'true'){
    const value=data.countryOfOrigin||''; const valid=/\S/.test(value); results.push({field:'countryOfOrigin',label:'Country of origin',present:Boolean(value.trim()),valid,extractedText:value,ruleRef:'Rule 6',violation:!valid,violationMessage:valid?'':'Country of origin is required for an imported commodity.'});
  }
  const violations=results.filter(r=>r.violation);
  const status=violations.length===0?'COMPLIANT':violations.length < Math.ceil(results.length/2)?'PARTIAL':'NON_COMPLIANT';
  return {results,violations,status,score:Math.round(((results.length-violations.length)/results.length)*100)};
}
