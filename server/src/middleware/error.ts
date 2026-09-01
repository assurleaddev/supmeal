import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  // Une erreur de validation est une faute du client, pas du serveur. Elle est traitée ici plutôt
  // que dans chaque route : sans ce cas, un corps de requête malformé remontait en 500.
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // Prisma unique constraint violation
  if ((err as any).code === 'P2002') {
    res.status(409).json({ success: false, message: 'Resource already exists' });
    return;
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    res.status(404).json({ success: false, message: 'Resource not found' });
    return;
  }

  // Contrainte de clé étrangère : la ressource est encore référencée ailleurs. C'est un conflit
  // d'état, pas une panne serveur, et le message doit être exploitable côté client.
  if ((err as any).code === 'P2003') {
    res.status(409).json({
      success: false,
      message: 'Resource is still referenced by other records and cannot be deleted',
    });
    return;
  }

  // Erreurs de multer. Envoyer une photo trop lourde est une faute du client, mais l'erreur
  // remontait en « 500 Internal server error » : l'utilisateur ne pouvait pas deviner qu'il
  // suffisait de réduire son image. Les limites sont rappelées dans le message, faute de quoi il
  // faudrait lire le code pour les connaître.
  if (err.name === 'MulterError') {
    const code = (err as any).code as string;
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? 'File too large — 5 MB maximum for a recipe image, 10 MB for an import file'
        : code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field'
          : `Upload rejected (${code})`;

    res.status(400).json({ success: false, message });
    return;
  }

  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
}
