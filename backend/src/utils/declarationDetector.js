const rules=[
 {field:'mrp',label:'Maximum Retail Price (MRP)',ruleRef:'Rule 6',patterns:[/\b(?:mrp|maximum retail price)\s*(?:rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?/i]},
 {field:'netQuantity',label:'Net quantity',ruleRef:'Rule 6',patterns:[/\bnet\s*(?:quantity|qty|wt\.?|weight)?\s*[:\-]?\s*\d+(?:\.\d+)?\s*(?:mg|g|kg|ml|l|nos?\.?|pcs?\.?|pieces?)\b/i]},
 {field:'manufactureDate',label:'Month and year',ruleRef:'Rule 6',patterns:[/(?:packed|manufactur(?:ed|e)|mfg|import(?:ed|ing)?).{0,30}(?:\b(?:0?[1-9]|1[0-2])\s*[\/\-]\s*\d{4}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*\d{4}\b)/i]},
 {field:'manufacturer',label:'Manufacturer / packer / importer',ruleRef:'Rule 6',patterns:[/(?:manufactured|packed|imported)\s+by[\s\S]{10,200}/i]},
 {field:'consumerCare',label:'Consumer care details',ruleRef:'Rule 6',patterns:[/(?:consumer|customer)\s*care[\s\S]{0,150}(?:\+?91[-\s]?)?[6-9]\d{9}/i,/(?:consumer|customer)\s*care[\s\S]{0,150}[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i]},
 {field:'countryOfOrigin',label:'Country of origin',ruleRef:'Rule 6',patterns:[/\bcountry\s+of\s+origin\s*[:\-]?\s*[A-Za-z ]{2,}/i]},
 {field:'bestBefore',label:'Best before / use by / expiry',ruleRef:'Rule 6',patterns:[/\b(?:best\s*before|use\s*by|expiry|expires?)\b.{0,60}/i]},
 {field:'unitSalePrice',label:'Unit sale price',ruleRef:'Rule 6',patterns:[/\b(?:rs\.?\s*\/\s*(?:kg|g|l|ml)|unit\s*sale\s*price)\b.{0,30}/i]}
];
export function detectDeclarations(text){const clean=(text||'').replace(/\r/g,'');return rules.map(r=>{for(const p of r.patterns){const m=clean.match(p);if(m)return {...r,present:true,valid:true,extractedText:m[0].trim()};}return {...r,present:false,valid:false,extractedText:''};});}
