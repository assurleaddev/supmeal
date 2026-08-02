import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/database';
import { AuthenticatedRequest, ExportData } from '../types';

const router = Router();

// GET /api/export — export all user data
router.get('/', requireAuth as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, username: true },
    });

    // Personal recipes
    const personalRecipes = await prisma.recipe.findMany({
      where: { createdById: req.user.id, isPersonal: true },
      include: {
        ingredients: { include: { ingredient: true }, orderBy: { orderIndex: 'asc' } },
        steps: { orderBy: { orderIndex: 'asc' } },
        tags: { include: { tag: true } },
      },
    });

    // Cookbooks the user created
    const cookbooks = await prisma.cookbook.findMany({
      where: { createdById: req.user.id },
      include: {
        recipes: {
          include: {
            ingredients: { include: { ingredient: true }, orderBy: { orderIndex: 'asc' } },
            steps: { orderBy: { orderIndex: 'asc' } },
            tags: { include: { tag: true } },
          },
        },
      },
    });

    const serializeRecipe = (r: any) => ({
      title: r.title,
      description: r.description,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      portions: r.portions,
      sourceUrl: r.sourceUrl,
      imageUrl: r.imageUrl,
      ingredients: r.ingredients.map((ri: any) => ({
        name: ri.ingredient.name,
        quantity: ri.quantity,
        unit: ri.unit,
        notes: ri.notes,
        orderIndex: ri.orderIndex,
      })),
      steps: r.steps.map((s: any) => ({
        orderIndex: s.orderIndex,
        description: s.description,
        duration: s.duration,
      })),
      tags: r.tags.map((rt: any) => ({ name: rt.tag.name, type: rt.tag.type })),
    });

    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      user: { email: user!.email, username: user!.username },
      personalRecipes: personalRecipes.map(serializeRecipe),
      cookbooks: cookbooks.map((cb) => ({
        name: cb.name,
        description: cb.description ?? undefined,
        recipes: cb.recipes.map(serializeRecipe),
      })),
    };

    if (format === 'csv') {
      // Flatten to CSV format
      const rows: string[] = [];
      rows.push('cookbook,title,description,prepTime,cookTime,portions,sourceUrl,tags,ingredients,steps');

      const flattenRecipes = (recipes: any[], cookbookName: string) => {
        for (const r of recipes) {
          const tags = r.tags.map((t: any) => t.name).join(';');
          const ings = r.ingredients
            .map((i: any) => `${i.quantity ?? ''}${i.unit ?? ''} ${i.name}`.trim())
            .join(';');
          const steps = r.steps.map((s: any) => s.description).join(';');
          rows.push(
            [cookbookName, r.title, r.description ?? '', r.prepTime ?? '', r.cookTime ?? '',
              r.portions, r.sourceUrl ?? '', tags, ings, steps]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(','),
          );
        }
      };

      flattenRecipes(exportData.personalRecipes, 'Personal');
      for (const cb of exportData.cookbooks) {
        flattenRecipes(cb.recipes, cb.name);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="supmeal-export.csv"');
      res.send(rows.join('\n'));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="supmeal-export.json"');
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

export default router;
