import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { AuthenticatedRequest, ExportData } from '../types';

const router = Router();

// Use memory storage for import files (parsed immediately)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json') ||
        file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only JSON or CSV files are allowed', 400));
    }
  },
}).single('file');

// POST /api/import
router.post('/', requireAuth as any, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  memoryUpload(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next(new AppError('No file uploaded', 400));

    try {
      const content = req.file.buffer.toString('utf-8');
      const ext = req.file.originalname.split('.').pop()?.toLowerCase();

      let data: ExportData;

      if (ext === 'csv') {
        data = parseCsvImport(content, req.user);
      } else {
        data = JSON.parse(content) as ExportData;
      }

      if (!data.personalRecipes && !data.cookbooks) {
        throw new AppError('Invalid import format', 400);
      }

      const results = { recipes: 0, cookbooks: 0, errors: [] as string[] };

      // Import personal recipes
      for (const recipeData of (data.personalRecipes || [])) {
        try {
          await importRecipe(recipeData, req.user.id, null);
          results.recipes++;
        } catch (e) {
          results.errors.push(`Recipe "${recipeData.title}": ${(e as Error).message}`);
        }
      }

      // Import cookbooks
      for (const cbData of (data.cookbooks || [])) {
        try {
          const cookbook = await prisma.cookbook.create({
            data: {
              name: cbData.name,
              description: cbData.description,
              createdById: req.user.id,
              members: { create: { userId: req.user.id, role: 'CREATOR' } },
            },
          });
          results.cookbooks++;

          for (const recipeData of (cbData.recipes || [])) {
            try {
              await importRecipe(recipeData, req.user.id, cookbook.id);
              results.recipes++;
            } catch (e) {
              results.errors.push(`Recipe "${recipeData.title}" in "${cbData.name}": ${(e as Error).message}`);
            }
          }
        } catch (e) {
          results.errors.push(`Cookbook "${cbData.name}": ${(e as Error).message}`);
        }
      }

      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  });
});

async function importRecipe(recipeData: any, userId: string, cookbookId: string | null) {
  const ingredientUpserts = await Promise.all(
    (recipeData.ingredients || []).map((ing: any) =>
      prisma.ingredient.upsert({
        where: { name: ing.name.toLowerCase().trim() },
        update: {},
        create: { name: ing.name.toLowerCase().trim() },
      }),
    ),
  );

  const tagUpserts = await Promise.all(
    (recipeData.tags || []).map((tag: any) => {
      const name = typeof tag === 'string' ? tag : tag.name;
      const type = typeof tag === 'string' ? 'CUSTOM' : (tag.type || 'CUSTOM');
      return prisma.tag.upsert({
        where: { name: name.toLowerCase().trim() },
        update: {},
        create: { name: name.toLowerCase().trim(), type },
      });
    }),
  );

  await prisma.recipe.create({
    data: {
      title: recipeData.title,
      description: recipeData.description,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      portions: recipeData.portions || 4,
      sourceUrl: recipeData.sourceUrl,
      isPersonal: !cookbookId,
      createdById: userId,
      cookbookId,
      ingredients: {
        create: (recipeData.ingredients || []).map((ing: any, i: number) => ({
          ingredientId: ingredientUpserts[i].id,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          orderIndex: ing.orderIndex ?? i,
        })),
      },
      steps: {
        create: (recipeData.steps || []).map((step: any, i: number) => ({
          orderIndex: step.orderIndex ?? i,
          description: step.description,
          duration: step.duration,
        })),
      },
      tags: {
        create: tagUpserts.map((tag) => ({ tagId: tag.id })),
      },
    },
  });
}

function parseCsvImport(csv: string, user: { id: string; email: string; username: string }): ExportData {
  const lines = csv.split('\n').filter((l) => l.trim());
  if (lines.length < 2) throw new AppError('CSV file is empty', 400);

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const recipes: any[] = [];
  const cookbookMap = new Map<string, any[]>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    const recipe = {
      title: row.title || `Imported Recipe ${i}`,
      description: row.description || undefined,
      prepTime: row.prepTime ? Number(row.prepTime) : undefined,
      cookTime: row.cookTime ? Number(row.cookTime) : undefined,
      portions: row.portions ? Number(row.portions) : 4,
      sourceUrl: row.sourceUrl || undefined,
      ingredients: (row.ingredients || '').split(';').filter(Boolean).map((ing, idx) => ({
        name: ing.trim(),
        orderIndex: idx,
      })),
      steps: (row.steps || '').split(';').filter(Boolean).map((desc, idx) => ({
        description: desc.trim(),
        orderIndex: idx,
      })),
      tags: (row.tags || '').split(';').filter(Boolean).map((t) => t.trim()),
    };

    const cb = row.cookbook || 'Personal';
    if (cb === 'Personal') {
      recipes.push(recipe);
    } else {
      if (!cookbookMap.has(cb)) cookbookMap.set(cb, []);
      cookbookMap.get(cb)!.push(recipe);
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    user: { email: user.email, username: user.username },
    personalRecipes: recipes,
    cookbooks: Array.from(cookbookMap.entries()).map(([name, cbRecipes]) => ({ name, recipes: cbRecipes })),
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export default router;
