import crypto from 'crypto';
import {query} from '../config/db.js';
import {runOCR} from './ocrService.js';
import {detectDeclarations} from '../utils/declarationDetector.js';
import {evaluateCompliance} from '../utils/rules.js';
export async function createInspection({body,files,user}){
 let combinedText=''; const ocrResults=[];
 for(const f of files){try{const ocr=await runOCR(f.path);ocrResults.push({image:f.originalname,...ocr});combinedText+=`\n${ocr.text}`;}catch(e){ocrResults.push({image:f.originalname,error:e.message});}}
 const declarations=detectDeclarations(combinedText); const analysis=evaluateCompliance(body,declarations); const id=crypto.randomUUID();
 await query(`INSERT INTO inspections(id,user_id,brand,product_name,category,sku,barcode,manufacturer,retailer,location,notes,status,score,analysis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[id,user.id,body.brand||'',body.productName||'',body.category||'',body.sku||'',body.barcode||'',body.manufacturer||'',body.retailer||'',body.location||'',body.notes||'',analysis.status,analysis.score,JSON.stringify({...analysis,ocrText:combinedText,ocrResults})]);
 for(const f of files) await query('INSERT INTO inspection_images(id,inspection_id,original_name,path) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),id,f.originalname,`/uploads/${f.filename}`]);
 return getInspection(id);
}
export async function listInspections(user){const where=user.role==='INSPECTOR'?'WHERE i.user_id=$1':'';const params=user.role==='INSPECTOR'?[user.id]:[];const r=await query(`SELECT i.*,u.name as inspector_name FROM inspections i LEFT JOIN users u ON u.id=i.user_id ${where} ORDER BY i.created_at DESC`,params);return r.rows;}
export async function getInspection(id){const r=await query('SELECT i.*,u.name as inspector_name,u.email as inspector_email FROM inspections i LEFT JOIN users u ON u.id=i.user_id WHERE i.id=$1',[id]);if(!r.rows[0])return null;const imgs=await query('SELECT original_name as name,path FROM inspection_images WHERE inspection_id=$1 ORDER BY created_at',[id]);const x=r.rows[0];return {...x,product:{brand:x.brand,productName:x.product_name,category:x.category,sku:x.sku,barcode:x.barcode,manufacturer:x.manufacturer},inspection:{retailer:x.retailer,location:x.location,notes:x.notes},analysis:x.analysis,images:imgs.rows};}
