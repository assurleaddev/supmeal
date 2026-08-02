import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { mealPlanApi, recipeApi } from '../api';
import { MealType, MealPlanItem, Recipe } from '../types';
import { Button } from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useForm } from 'react-hook-form';

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  SNACK: 'Encas',
};
const MEAL_ICONS: Record<MealType, string> = {
  BREAKFAST: '☀️', LUNCH: '🌞', DINNER: '🌙', SNACK: '🍎',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function MealPlanner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemTarget, setAddItemTarget] = useState<{ date: Date; mealType: MealType } | null>(null);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const queryClient = useQueryClient();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

  const { data: plans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => mealPlanApi.list().then((r) => r.data.data!),
  });

  // Find or use selected plan for this week
  const currentPlan = selectedPlanId
    ? plans?.find((p) => p.id === selectedPlanId)
    : plans?.find((p) => p.weekStart.startsWith(weekStartStr));

  const { data: shoppingList } = useQuery({
    queryKey: ['shopping-list', currentPlan?.id],
    queryFn: () => mealPlanApi.getShoppingList(currentPlan!.id).then((r) => r.data.data!),
    enabled: shoppingListOpen && Boolean(currentPlan?.id),
  });

  const { data: recipesData } = useQuery({
    queryKey: ['recipes', { q: recipeSearch, limit: 10 }],
    queryFn: () => recipeApi.list({ q: recipeSearch || undefined, limit: 10 }).then((r) => r.data.data!),
    enabled: addItemOpen,
  });

  const handleCreatePlan = async () => {
    try {
      const res = await mealPlanApi.create({
        name: `Semaine du ${format(currentWeekStart, 'd MMMM yyyy', { locale: fr })}`,
        weekStart: weekStartStr,
      });
      setSelectedPlanId(res.data.data!.id);
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      toast.success('Planning créé !');
    } catch { toast.error('Erreur'); }
  };

  const handleAddItem = async () => {
    if (!addItemTarget || !selectedRecipe || !currentPlan) return;
    try {
      await mealPlanApi.addItem(currentPlan.id, {
        recipeId: selectedRecipe.id,
        date: format(addItemTarget.date, 'yyyy-MM-dd'),
        mealType: addItemTarget.mealType,
      });
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      toast.success('Ajouté au planning !');
      setAddItemOpen(false);
      setSelectedRecipe(null);
      setRecipeSearch('');
    } catch { toast.error('Erreur'); }
  };

  const handleRemoveItem = async (planId: string, itemId: string) => {
    try {
      await mealPlanApi.removeItem(planId, itemId);
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
    } catch { toast.error('Erreur'); }
  };

  const openAddItem = (date: Date, mealType: MealType) => {
    setAddItemTarget({ date, mealType });
    setAddItemOpen(true);
  };

  const getItemsFor = (date: Date, mealType: MealType): MealPlanItem[] => {
    if (!currentPlan) return [];
    return currentPlan.items.filter((item) => {
      const itemDate = parseISO(item.date);
      return isSameDay(itemDate, date) && item.mealType === mealType;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning de repas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Semaine du {format(currentWeekStart, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart((d) => addDays(d, -7))}>← Semaine précédente</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart((d) => addDays(d, 7))}>Semaine suivante →</Button>
          {currentPlan && (
            <Button variant="secondary" size="sm" onClick={() => setShoppingListOpen(true)}>
              🛒 Liste de courses
            </Button>
          )}
        </div>
      </div>

      {/* Plan selector */}
      {plans && plans.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                currentPlan?.id === p.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.name || `Semaine du ${format(parseISO(p.weekStart), 'd MMM', { locale: fr })}`}
            </button>
          ))}
        </div>
      )}

      {/* Create plan CTA */}
      {!currentPlan && (
        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 mb-2">Aucun planning pour cette semaine</h3>
          <p className="text-gray-500 text-sm mb-4">Créez un planning pour organiser vos repas</p>
          <Button onClick={handleCreatePlan}>Créer le planning de la semaine</Button>
        </div>
      )}

      {/* Weekly grid */}
      {currentPlan && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`text-center py-3 px-2 border-r border-gray-100 last:border-0 ${
                  isSameDay(day, new Date()) ? 'bg-primary-50' : ''
                }`}
              >
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  {format(day, 'EEE', { locale: fr })}
                </div>
                <div className={`text-lg font-bold mt-0.5 ${isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="border-b border-gray-100 last:border-0">
              <div className="grid grid-cols-7">
                {weekDays.map((day) => {
                  const items = getItemsFor(day, mealType);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[90px] p-2 border-r border-gray-100 last:border-0 ${
                        isSameDay(day, new Date()) ? 'bg-primary-50/30' : ''
                      }`}
                    >
                      {/* Meal type label — only on first column */}
                      {day === weekDays[0] && (
                        <div className="text-xs text-gray-400 mb-1 whitespace-nowrap hidden">
                          {MEAL_ICONS[mealType]} {MEAL_LABELS[mealType]}
                        </div>
                      )}
                      <div className="space-y-1">
                        {items.map((item) => {
                          const imgUrl = item.recipe.imageUrl
                            ? item.recipe.imageUrl.startsWith('http')
                              ? item.recipe.imageUrl
                              : `${API_URL}${item.recipe.imageUrl}`
                            : null;
                          return (
                            <div
                              key={item.id}
                              className="bg-primary-50 border border-primary-100 rounded-lg p-1.5 group relative"
                            >
                              <p className="text-xs font-medium text-primary-800 line-clamp-2 leading-tight">
                                {item.recipe.title}
                              </p>
                              <button
                                onClick={() => handleRemoveItem(currentPlan.id, item.id)}
                                className="absolute top-0.5 right-0.5 hidden group-hover:flex w-4 h-4 items-center justify-center bg-red-500 text-white rounded-full text-[10px]"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => openAddItem(day, mealType)}
                          className="w-full text-xs text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg py-1 transition-colors text-center border border-dashed border-transparent hover:border-primary-200"
                        >
                          + {MEAL_ICONS[mealType]}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-50 px-3 py-1 text-xs text-gray-400 border-t border-gray-100">
                {MEAL_ICONS[mealType]} {MEAL_LABELS[mealType]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add item modal */}
      <Modal isOpen={addItemOpen} onClose={() => { setAddItemOpen(false); setSelectedRecipe(null); setRecipeSearch(''); }} title="Ajouter une recette" size="md">
        <div className="space-y-4">
          {addItemTarget && (
            <p className="text-sm text-gray-600">
              {MEAL_ICONS[addItemTarget.mealType]} {MEAL_LABELS[addItemTarget.mealType]} —{' '}
              <strong>{format(addItemTarget.date, 'EEEE d MMMM', { locale: fr })}</strong>
            </p>
          )}

          <input
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder="Rechercher une recette..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {recipesData?.items.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setSelectedRecipe(recipe)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  selectedRecipe?.id === recipe.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-10 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_URL}${recipe.imageUrl}`}
                      className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm">🍽</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{recipe.title}</p>
                  {recipe.prepTime && <p className="text-xs text-gray-400">{recipe.prepTime} min prép.</p>}
                </div>
                {selectedRecipe?.id === recipe.id && (
                  <svg className="h-4 w-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAddItemOpen(false)}>Annuler</Button>
            <Button onClick={handleAddItem} disabled={!selectedRecipe}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      {/* Shopping list modal */}
      <Modal isOpen={shoppingListOpen} onClose={() => setShoppingListOpen(false)} title="🛒 Liste de courses" size="md">
        <div className="space-y-3">
          {!shoppingList ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : shoppingList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucun ingrédient pour cette semaine</div>
          ) : (
            <>
              <p className="text-sm text-gray-500">{shoppingList.length} ingrédient{shoppingList.length > 1 ? 's' : ''} à acheter</p>
              <div className="divide-y divide-gray-50">
                {shoppingList.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-800 capitalize">{item.name}</span>
                    <span className="text-sm text-gray-500">
                      {item.totalQuantity !== null && `${Math.round(item.totalQuantity * 100) / 100}`}
                      {item.unit && ` ${item.unit}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
