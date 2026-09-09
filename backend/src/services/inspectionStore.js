const inspections = [];
export function listInspections(){ return inspections; }
export function getInspection(id){ return inspections.find(x=>x.id===id); }
export function addInspection(item){ inspections.unshift(item); return item; }
