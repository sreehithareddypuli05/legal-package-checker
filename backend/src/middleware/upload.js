import multer from 'multer';
import path from 'path';
import fs from 'fs';
const uploadDir=path.resolve('uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({destination:(_,__,cb)=>cb(null,uploadDir),filename:(_,file,cb)=>{const ext=path.extname(file.originalname);cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);}});
export const upload=multer({storage,limits:{files:5,fileSize:10*1024*1024},fileFilter:(_,file,cb)=>cb(null,file.mimetype.startsWith('image/'))});
