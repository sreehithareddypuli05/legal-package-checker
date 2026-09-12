export async function downloadEditableReport(payload:any){
  const base=(import.meta as any).env?.VITE_API_URL||'http://localhost:8001';
  const body={
    inspectionId:String(payload.inspectionId||''),
    inspector:String(payload.inspector||'Demo Inspector'),
    company:String(payload.company||'Company requiring identification'),
    productName:String(payload.productName||'Packaged commodity'),
    result:String(payload.result||'NEEDS REVIEW'),
    status:String(payload.status||'ANALYZED'),
    adminNote:String(payload.adminNote||''),
    checks:Array.isArray(payload.checks)?payload.checks.map((c:any)=>({field:String(c?.field??''),value:String(c?.value??''),status:String(c?.status??'REVIEW'),reason:String(c?.reason??'')})):[],
    generatedAt:String(payload.generatedAt||new Date().toISOString())
  };
  const res=await fetch(`${base}/reports/editable-pdf`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/pdf'},body:JSON.stringify(body)});
  if(!res.ok){const text=await res.text().catch(()=>"");throw new Error(`Report server returned ${res.status}: ${text}`)}
  const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SIH26034-${body.inspectionId}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
