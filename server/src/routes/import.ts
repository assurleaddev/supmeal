import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import * as transferService from '../services/transferService';

/** Adaptateur HTTP de l'import — voir services/transferService.ts. */
const router = Router();

// Le fichier est analysé immédiatement puis jeté : inutile de l'écrire sur disque.
const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const accepted =
      file.mimetype === 'application/json' ||
      file.mimetype === 'text/csv' ||
      name.endsWith('.json') ||
      name.endsWith('.csv');

    if (accepted) cb(null, true);
    else cb(new AppError('Only JSON or CSV files are allowed', 400));
  },
}).single('file');

// POST /api/import
router.post('/', requireAuth as any, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  uploadImportFile(req, res, async (uploadError) => {
    if (uploadError) return next(uploadError);
    if (!req.file) return next(new AppError('No file uploaded', 400));

    try {
      const payload = transferService.parseImportFile(
        req.file.buffer.toString('utf-8'),
        req.file.originalname,
      );
      const report = await transferService.importData(req.user.id, payload);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  });
});

export default router;
