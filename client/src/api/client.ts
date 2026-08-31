import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Les jetons sont lus dans le store d'authentification, seule source de vérité.
 *
 * Ils étaient auparavant lus et effacés directement dans `localStorage`, en parallèle du store
 * zustand persisté qui conserve `isAuthenticated`. Vider les clés sans réinitialiser le store
 * laissait l'application se croire connectée : `/login` renvoyait vers `/home`, dont les requêtes
 * repartaient en 401 et provoquaient un nouveau `window.location.href` — la page se rechargeait
 * en boucle sans fin.
 */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Déconnecte proprement puis renvoie vers la page de connexion, sans boucler si on y est déjà. */
function forceLogout() {
  useAuthStore.getState().logout();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Rafraîchissement automatique sur 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // Les routes d'authentification sont exclues : un 401 y est une réponse métier légitime
    // (identifiants invalides), pas un jeton expiré à renouveler.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/')
    ) {
      return Promise.reject(error);
    }

    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    // Une seule requête de renouvellement à la fois : les autres attendent le nouveau jeton
    // plutôt que de déclencher chacune leur propre rotation.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
        setTimeout(() => reject(error), 15000);
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = data.data;

      const { user } = useAuthStore.getState();
      if (user) useAuthStore.getState().setAuth(user, accessToken, newRefreshToken);

      refreshQueue.forEach((resume) => resume(accessToken));
      refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      refreshQueue = [];
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
