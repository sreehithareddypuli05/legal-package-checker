import {Router} from 'express';import {createInspection,getAll,getOne} from '../controllers/inspectionController.js';import {upload} from '../middleware/upload.js';import {requireAuth} from '../middleware/auth.js';
const r=Router();r.use(requireAuth);r.get('/',getAll);r.get('/:id',getOne);r.post('/',upload.array('images',5),createInspection);export default r;
