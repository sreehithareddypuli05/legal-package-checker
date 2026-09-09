import { Router } from 'express';
import { createInspection, getAll, getOne } from '../controllers/inspectionController.js';
import { upload } from '../middleware/upload.js';
const router=Router();
router.get('/',getAll); router.get('/:id',getOne); router.post('/',upload.array('images',5),createInspection); export default router;
