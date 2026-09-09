import path from 'path';
import sharp from 'sharp';
import {createWorker} from 'tesseract.js';
import {env} from '../config/env.js';
let workerPromise;
async function getWorker(){if(!workerPromise) workerPromise=createWorker(env.ocrLang); return workerPromise;}
export async function preprocessImage(filePath){
 const out=path.join(path.dirname(filePath),`preprocessed-${path.basename(filePath)}`);
 await sharp(filePath).rotate().grayscale().normalize().sharpen().png().toFile(out);
 return out;
}
export async function runOCR(filePath){
 const processed=await preprocessImage(filePath); const worker=await getWorker(); const {data}=await worker.recognize(processed);
 const words=(data.words||[]).filter(w=>(w.text||'').trim()).map(w=>({text:w.text.trim(),confidence:Number(w.confidence||0),bbox:{x0:w.bbox.x0,y0:w.bbox.y0,x1:w.bbox.x1,y1:w.bbox.y1}}));
 return {text:(data.text||'').trim(),confidence:Number(data.confidence||0),words,preprocessedPath:processed};
}
