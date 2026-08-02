import { CookbookRole, MealType, TagType } from '@prisma/client';
import { Request } from 'express';

// ─────────────────────────────────────────
// Authenticated Request
// ─────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
  };
}

// ─────────────────────────────────────────
// JWT Payloads
// ─────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

// ─────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─────────────────────────────────────────
// Recipe Types
// ─────────────────────────────────────────

export interface RecipeIngredientInput {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  orderIndex?: number;
}

export interface RecipeStepInput {
  description: string;
  duration?: number;
  orderIndex: number;
}

export interface CreateRecipeInput {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  portions?: number;
  sourceUrl?: string;
  isPersonal?: boolean;
  cookbookId?: string;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
  tags?: string[];
}

// ─────────────────────────────────────────
// Export / Import Types
// ─────────────────────────────────────────

export interface ExportedRecipe {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  portions: number;
  sourceUrl?: string;
  imageUrl?: string;
  ingredients: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    notes?: string;
    orderIndex: number;
  }>;
  steps: Array<{
    orderIndex: number;
    description: string;
    duration?: number;
  }>;
  tags: Array<{ name: string; type: string }>;
}

export interface ExportedCookbook {
  name: string;
  description?: string;
  recipes: ExportedRecipe[];
}

export interface ExportData {
  exportedAt: string;
  version: string;
  user: { email: string; username: string };
  personalRecipes: ExportedRecipe[];
  cookbooks: ExportedCookbook[];
}

// ─────────────────────────────────────────
// Socket.io Events
// ─────────────────────────────────────────

export interface ServerToClientEvents {
  'cookbook:message': (message: ChatMessage) => void;
  'cookbook:joined': (data: { userId: string; username: string }) => void;
  'cookbook:left': (data: { userId: string }) => void;
}

export interface ClientToServerEvents {
  'cookbook:join': (cookbookId: string) => void;
  'cookbook:leave': (cookbookId: string) => void;
  'cookbook:sendMessage': (data: { cookbookId: string; content: string }) => void;
}

export interface ChatMessage {
  id: string;
  cookbookId: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  createdAt: string;
}

export { CookbookRole, MealType, TagType };
