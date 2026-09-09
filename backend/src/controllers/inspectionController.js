import crypto from 'crypto';
import { addInspection, getInspection, listInspections } from '../services/inspectionStore.js';
import { evaluateCompliance } from '../utils/rules.js';
export function createInspection(req,res){
  const body=req.body;
  const analysis=evaluateCompliance(body);
  const item={id:crypto.randomUUID(),createdAt:new Date().toISOString(),product:{brand:body.brand||'',productName:body.productName||'',category:body.category||'',sku:body.sku||'',barcode:body.barcode||'',manufacturer:body.manufacturer||''},inspection:{retailer:body.retailer||'',location:body.location||'',notes:body.notes||''},inputDeclarations:Object.fromEntries(['mrp','netQuantity','manufactureDate','consumerCare','bestBefore','countryOfOrigin'].map(k=>[k,body[k]||''])),images:(req.files||[]).map(f=>({name:f.originalname,path:`/uploads/${f.filename}`})),analysis};
  addInspection(item); res.status(201).json(item);
}
export function getAll(req,res){res.json(listInspections());}
export function getOne(req,res){const item=getInspection(req.params.id); if(!item) return res.status(404).json({message:'Inspection not found'}); res.json(item);}
