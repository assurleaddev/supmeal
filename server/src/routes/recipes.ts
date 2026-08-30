import { Router, Response, NextFunction, Request } from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadRecipeImage } from '../middleware/upload';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest } from '../types';
import * as recipeService from '../services/recipeService';

/**
 * Adaptateur HTTP des recettes : extraction des paramètres, appel du service, mise en forme de la
 * réponse. Aucune règle métier ni accès direct à la base ici — voir services/recipeService.ts.
 * Les erreurs de validation Zod sont converties en 400 par le middleware d'erreur.
 */
const router = Router();

// GET /api/recipes — recherche et filtrage
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = recipeService.recipeQuerySchema.parse(req.query);
    const data = await recipeService.listRecipes(req.user.id, query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes
router.post('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = recipeService.recipeSchema.parse(req.body);
    const recipe = await recipeService.createRecipe(req.user.id, input);
    res.status(201).json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id
router.get('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recipe = await recipeService.getRecipe(req.params.id, req.user.id);
    res.json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
});

// PUT /api/recipes/:id
router.put('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const input = recipeService.recipeUpdateSchema.parse(req.body);
    const recipe = await recipeService.updateRecipe(req.params.id, req.user.id, input);
    res.json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await recipeService.deleteRecipe(req.params.id, req.user.id);
    res.json({ success: true, message: 'Recipe deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes/:id/image
router.post(
  '/:id/image',
  requireAuth as any,
  (req: Request, res: Response, next: NextFunction) => uploadRecipeImage(req, res, next),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No image uploaded', 400);
      const recipe = await recipeService.setRecipeImage(req.params.id, req.user.id, req.file.filename);
      res.json({ success: true, data: recipe });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/recipes/:id/favorite
router.post('/:id/favorite', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await recipeService.setFavorite(req.user.id, req.params.id, true);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:id/favorite
router.delete('/:id/favorite', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await recipeService.setFavorite(req.user.id, req.params.id, false);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/recipes/:id/comments
router.get('/:id/comments', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comments = await recipeService.listComments(req.params.id, req.user.id);
    res.json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipes/:id/comments
router.post('/:id/comments', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { content } = recipeService.commentSchema.parse(req.body);
    const comment = await recipeService.addComment(req.params.id, req.user.id, content);
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recipes/:recipeId/comments/:commentId
router.delete('/:recipeId/comments/:commentId', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await recipeService.deleteComment(req.params.commentId, req.user.id);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
