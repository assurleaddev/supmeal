// ─────────────────────────────────────────
// Core Domain Types
// ─────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string | null;
  createdAt: string;
  preferences?: UserPreferences | null;
  oauthAccounts?: { id: string; provider: string }[];
}

export interface UserPreferences {
  id: string;
  userId: string;
  diet: string[];
  allergies: string[];
  cuisineTypes: string[];
  defaultPortions: number;
}

export type CookbookRole = 'CREATOR' | 'EDITOR' | 'COMMENTER' | 'READER';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type TagType = 'CATEGORY' | 'DIET' | 'DIFFICULTY' | 'CUISINE' | 'CUSTOM';

export interface Cookbook {
  id: string;
  name: string;
  description?: string | null;
  coverImage?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; username: string; avatar?: string | null };
  myRole: CookbookRole;
  members?: CookbookMember[];
  _count?: { recipes: number; members: number };
}

export interface CookbookMember {
  id: string;
  cookbookId: string;
  userId: string;
  role: CookbookRole;
  joinedAt: string;
  user: { id: string; username: string; avatar?: string | null; email: string };
}

export interface Tag {
  id: string;
  name: string;
  type: TagType;
}

export interface Ingredient {
  id: string;
  name: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  orderIndex: number;
  ingredient: Ingredient;
}

export interface RecipeStep {
  id: string;
  recipeId: string;
  orderIndex: number;
  description: string;
  duration?: number | null;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  portions: number;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  isPersonal: boolean;
  createdById: string;
  cookbookId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; username: string; avatar?: string | null };
  cookbook?: { id: string; name: string } | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: { tag: Tag }[];
  isFavorite?: boolean;
  _count?: { favorites: number; comments: number };
}

export interface Comment {
  id: string;
  recipeId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; username: string; avatar?: string | null };
}

export interface Message {
  id: string;
  cookbookId: string;
  userId: string;
  username: string;
  avatar?: string | null;
  content: string;
  createdAt: string;
  user?: { id: string; username: string; avatar?: string | null };
}

export interface MealPlan {
  id: string;
  userId: string;
  cookbookId?: string | null;
  name?: string | null;
  weekStart: string;
  createdAt: string;
  items: MealPlanItem[];
  cookbook?: { id: string; name: string } | null;
}

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  recipeId: string;
  date: string;
  mealType: MealType;
  portions?: number | null;
  recipe: { id: string; title: string; imageUrl?: string | null; prepTime?: number | null; cookTime?: number | null };
}

export interface ShoppingListItem {
  name: string;
  totalQuantity: number | null;
  unit: string | null;
  notes: string[];
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
// Form Input Types
// ─────────────────────────────────────────

export interface RecipeFormData {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  portions: number;
  sourceUrl?: string;
  isPersonal: boolean;
  cookbookId?: string;
  ingredients: { name: string; quantity?: number; unit?: string; notes?: string; orderIndex: number }[];
  steps: { description: string; duration?: number; orderIndex: number }[];
  tags: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
