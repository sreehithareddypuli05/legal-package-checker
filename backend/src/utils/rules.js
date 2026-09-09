export function evaluateCompliance(input,declarations=[]){
 const imported=String(input.imported||'false')==='true'; const results=declarations.length?declarations:[];
 const required=results.filter(r=>!(r.field==='countryOfOrigin'&&!imported)&&!(r.field==='unitSalePrice'));
 if(!input.bestBefore && ['food','beverage','medicine','cosmetic'].some(x=>String(input.category||'').toLowerCase().includes(x))){const r=results.find(x=>x.field==='bestBefore');if(r){r.valid=false;r.present=false;r.extractedText='';}}
 const passed=required.filter(r=>r.valid).length; const score=required.length?Math.round(passed/required.length*100):0;
 const violations=required.filter(r=>!r.valid).map(r=>({field:r.field,ruleRef:r.ruleRef,severity:'HIGH',description:`${r.label} is missing or could not be recognized.`}));
 return {status:score===100?'COMPLIANT':score>=50?'PARTIAL':'NON_COMPLIANT',score,results,violations};
}
