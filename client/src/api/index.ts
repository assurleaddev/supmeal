import api from './client';
import {
  ApiResponse,
  AuthTokens,
  Cookbook,
  CookbookMember,
  CookbookRole,
  Comment,
  Ingredient,
  MealPlan,
  MealPlanItem,
  MealType,
  Message,
  PaginatedResponse,
  Recipe,
  RecipeFormData,
  ShoppingListItem,
  Tag,
  User,
  UserPreferences,
  UserStats,
} from '../types';

// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post<ApiResponse<{ user: User } & AuthTokens>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ user: User } & AuthTokens>>('/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/refresh', { refreshToken }),
};

// ─────────────────────────────────────────
// Users
// ─────────────────────────────────────────

export const userApi = {
  getMe: () => api.get<ApiResponse<User>>('/users/me'),

  stats: () => api.get<ApiResponse<UserStats>>('/users/me/stats'),

  updateProfile: (data: { username?: string; avatar?: string | null }) =>
    api.patch<ApiResponse<User>>('/users/me', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<ApiResponse>('/users/me/change-password', data),

  updatePreferences: (data: Partial<UserPreferences>) =>
    api.patch<ApiResponse<UserPreferences>>('/users/me/preferences', data),

  unlinkOAuth: (provider: string) => api.delete(`/users/me/oauth/${provider}`),
};

// ─────────────────────────────────────────
// Cookbooks
// ─────────────────────────────────────────

export const cookbookApi = {
  list: () => api.get<ApiResponse<Cookbook[]>>('/cookbooks'),

  create: (data: { name: string; description?: string }) =>
    api.post<ApiResponse<Cookbook>>('/cookbooks', data),

  get: (id: string) => api.get<ApiResponse<Cookbook>>(`/cookbooks/${id}`),

  update: (id: string, data: { name?: string; description?: string | null }) =>
    api.patch<ApiResponse<Cookbook>>(`/cookbooks/${id}`, data),

  delete: (id: string) => api.delete(`/cookbooks/${id}`),

  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<ApiResponse<{ coverImage: string }>>(`/cookbooks/${id}/cover`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  invite: (id: string, data: { email: string; role?: CookbookRole }) =>
    api.post<ApiResponse<{ token: string; email: string; expiresAt: string }>>(`/cookbooks/${id}/invite`, data),

  join: (token: string) =>
    api.post<ApiResponse<{ cookbookId: string; cookbookName: string; role: CookbookRole }>>(`/cookbooks/join/${token}`),

  updateMemberRole: (id: string, userId: string, role: CookbookRole) =>
    api.patch(`/cookbooks/${id}/members/${userId}`, { role }),

  removeMember: (id: string, userId: string) =>
    api.delete(`/cookbooks/${id}/members/${userId}`),

  leave: (id: string) => api.delete(`/cookbooks/${id}/leave`),

  getMessages: (cookbookId: string, params?: { limit?: number; before?: string }) =>
    api.get<ApiResponse<(Message & { user: { id: string; username: string; avatar?: string | null } })[]>>(
      `/cookbooks/${cookbookId}/messages`,
      { params },
    ),
};

// ─────────────────────────────────────────
// Recipes
// ─────────────────────────────────────────

export interface RecipeFilters {
  q?: string;
  cookbookId?: string;
  tags?: string;
  ingredients?: string;
  maxPrepTime?: number;
  maxCookTime?: number;
  favorites?: boolean;
  page?: number;
  limit?: number;
}

export const recipeApi = {
  list: (filters?: RecipeFilters) =>
    api.get<ApiResponse<PaginatedResponse<Recipe>>>('/recipes', { params: filters }),

  create: (data: RecipeFormData) => api.post<ApiResponse<Recipe>>('/recipes', data),

  get: (id: string) => api.get<ApiResponse<Recipe>>(`/recipes/${id}`),

  update: (id: string, data: Partial<RecipeFormData>) =>
    api.put<ApiResponse<Recipe>>(`/recipes/${id}`, data),

  delete: (id: string) => api.delete(`/recipes/${id}`),

  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<ApiResponse<{ id: string; imageUrl: string }>>(`/recipes/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  favorite: (id: string) => api.post<ApiResponse<{ isFavorite: boolean }>>(`/recipes/${id}/favorite`),
  unfavorite: (id: string) => api.delete<ApiResponse<{ isFavorite: boolean }>>(`/recipes/${id}/favorite`),

  getComments: (id: string) => api.get<ApiResponse<Comment[]>>(`/recipes/${id}/comments`),

  addComment: (id: string, content: string) =>
    api.post<ApiResponse<Comment>>(`/recipes/${id}/comments`, { content }),

  deleteComment: (recipeId: string, commentId: string) =>
    api.delete(`/recipes/${recipeId}/comments/${commentId}`),
};

// ─────────────────────────────────────────
// Tags & Ingredients
// ─────────────────────────────────────────

export const tagApi = {
  list: (type?: string) => api.get<ApiResponse<Tag[]>>('/tags', { params: { type } }),
  create: (data: { name: string; type?: string }) => api.post<ApiResponse<Tag>>('/tags', data),
  searchIngredients: (q: string) => api.get<ApiResponse<Ingredient[]>>('/tags/ingredients', { params: { q } }),
};

// ─────────────────────────────────────────
// Meal Plans
// ─────────────────────────────────────────

export const mealPlanApi = {
  list: () => api.get<ApiResponse<MealPlan[]>>('/meal-plans'),

  create: (data: { name?: string; weekStart: string; cookbookId?: string | null }) =>
    api.post<ApiResponse<MealPlan>>('/meal-plans', data),

  get: (id: string) => api.get<ApiResponse<MealPlan>>(`/meal-plans/${id}`),

  delete: (id: string) => api.delete(`/meal-plans/${id}`),

  addItem: (planId: string, data: { recipeId: string; date: string; mealType: MealType; portions?: number }) =>
    api.post<ApiResponse<MealPlanItem>>(`/meal-plans/${planId}/items`, data),

  removeItem: (planId: string, itemId: string) =>
    api.delete(`/meal-plans/${planId}/items/${itemId}`),

  getShoppingList: (planId: string) =>
    api.get<ApiResponse<ShoppingListItem[]>>(`/meal-plans/${planId}/shopping-list`),
};

// ─────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────

export const dataApi = {
  exportData: (format: 'json' | 'csv' = 'json') =>
    api.get('/export', { params: { format }, responseType: 'blob' }),

  importData: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ApiResponse<{ recipes: number; cookbooks: number; errors: string[] }>>(
      '/import',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
};
