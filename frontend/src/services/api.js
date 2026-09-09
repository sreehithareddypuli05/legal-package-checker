const API=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
export async function getInspections(){const r=await fetch(`${API}/inspections`);if(!r.ok)throw new Error('Could not load inspections');return r.json();}
export async function getInspection(id){const r=await fetch(`${API}/inspections/${id}`);if(!r.ok)throw new Error('Could not load inspection');return r.json();}
export async function createInspection(data){const form=new FormData(); Object.entries(data).forEach(([k,v])=>{if(k==='images')v.forEach(f=>form.append('images',f));else form.append(k,v??'');}); const r=await fetch(`${API}/inspections`,{method:'POST',body:form}); if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||'Could not create inspection');} return r.json();}
