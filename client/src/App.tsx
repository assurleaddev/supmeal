import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CircularProgress, Box } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import theme from './theme';

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
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
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
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="50vh">
      <CircularProgress color="primary" />
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />

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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { borderRadius: '10px', fontSize: '14px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
