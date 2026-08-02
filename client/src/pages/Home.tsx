import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { recipeApi, cookbookApi, mealPlanApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '../components/ui/Button';
import RecipeCard from '../components/recipes/RecipeCard';

const MEAL_LABELS = { BREAKFAST: 'Petit-déj', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Encas' };

export default function Home() {
  const { user } = useAuthStore();

  const { data: recentRecipes } = useQuery({
    queryKey: ['recipes', { limit: 6, page: 1 }],
    queryFn: () => recipeApi.list({ limit: 6, page: 1 }).then((r) => r.data.data!),
  });

  const { data: cookbooks } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  const { data: mealPlans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => mealPlanApi.list().then((r) => r.data.data!),
  });

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekPlan = mealPlans?.find((p) => p.weekStart.startsWith(format(weekStart, 'yyyy-MM-dd')));
  const todaysMeals = weekPlan?.items.filter((item) => isSameDay(parseISO(item.date), today)) || [];

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">{greeting}, {user?.username} ! 👋</h1>
        <p className="text-primary-100 mt-1">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })}
        </p>

        {/* Today's meals */}
        {todaysMeals.length > 0 ? (
          <div className="mt-4">
            <p className="text-primary-200 text-sm mb-2">Au menu aujourd'hui :</p>
            <div className="flex flex-wrap gap-2">
              {todaysMeals.map((item) => (
                <Link key={item.id} to={`/recipes/${item.recipe.id}`}
                  className="bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-sm">
                  {MEAL_LABELS[item.mealType]} : {item.recipe.title}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-3">
            <Link to="/meal-planner">
              <Button variant="secondary" size="sm">📅 Planifier cette semaine</Button>
            </Link>
            <Link to="/recipes/new">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">+ Nouvelle recette</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Recettes', value: recentRecipes?.total ?? '...', icon: '🍽', to: '/recipes' },
          { label: 'Cookbooks', value: cookbooks?.length ?? '...', icon: '📚', to: '/cookbooks' },
          { label: 'Favoris', value: '...', icon: '❤️', to: '/recipes?favorites=true' },
          { label: 'Planifiés', value: weekPlan?.items.length ?? 0, icon: '📅', to: '/meal-planner' },
        ].map((stat) => (
          <Link key={stat.label} to={stat.to}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent recipes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recettes récentes</h2>
          <Link to="/recipes" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Voir tout →</Link>
        </div>
        {recentRecipes?.items.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="text-gray-500 mb-4">Vous n'avez encore aucune recette</p>
            <Link to="/recipes/new"><Button>Créer ma première recette</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRecipes?.items.slice(0, 6).map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>

      {/* Cookbooks */}
      {(cookbooks?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mes cookbooks</h2>
            <Link to="/cookbooks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Voir tout →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cookbooks?.slice(0, 3).map((cb) => (
              <Link key={cb.id} to={`/cookbooks/${cb.id}`}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl flex-shrink-0">📚</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{cb.name}</p>
                  <p className="text-xs text-gray-500">{cb._count?.recipes ?? 0} recettes • {cb._count?.members ?? 0} membres</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
