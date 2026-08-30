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

  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
}
