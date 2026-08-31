import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import * as transferService from '../services/transferService';

/** Adaptateur HTTP de l'export — voir services/transferService.ts. */
const router = Router();

// GET /api/export?format=json|csv
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format } = transferService.exportQuerySchema.parse(req.query);
    const data = await transferService.buildExport(req.user.id);

    if (format === 'mealie') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="supmeal-mealie.json"');
      res.json(transferService.toMealie(data));
      return;
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="supmeal-export.csv"');
      res.send(transferService.toCsv(data));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="supmeal-export.json"');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
