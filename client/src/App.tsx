import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';

// Lazy-load pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const OAuthCallback = lazy(() => import('./pages/auth/OAuthCallback'));
const Home = lazy(() => import('./pages/Home'));
const RecipeList = lazy(() => import('./pages/recipes/RecipeList'));
const RecipeDetail = lazy(() => import('./pages/recipes/RecipeDetail'));
const CreateEditRecipe = lazy(() => import('./pages/recipes/CreateEditRecipe'));
const CookbookList = lazy(() => import('./pages/cookbooks/CookbookList'));
const CookbookDetail = lazy(() => import('./pages/cookbooks/CookbookDetail'));
const MealPlanner = lazy(() => import('./pages/MealPlanner'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const DataTransfer = lazy(() => import('./pages/DataTransfer'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />

            {/* Private — inside layout */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="/recipes" element={<RecipeList />} />
              <Route path="/recipes/new" element={<CreateEditRecipe />} />
              <Route path="/recipes/:id" element={<RecipeDetail />} />
              <Route path="/recipes/:id/edit" element={<CreateEditRecipe />} />
              <Route path="/cookbooks" element={<CookbookList />} />
              <Route path="/cookbooks/:id" element={<CookbookDetail />} />
              <Route path="/meal-planner" element={<MealPlanner />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/data" element={<DataTransfer />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { borderRadius: '12px', fontSize: '14px' },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}
