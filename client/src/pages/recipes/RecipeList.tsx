import { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { recipeApi, cookbookApi, tagApi, RecipeFilters } from '../../api';
import { useDebounce } from '../../hooks/useDebounce';
import { Recipe } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import RecipeCard from '../../components/recipes/RecipeCard';

export default function RecipeList() {
  const [searchParams] = useSearchParams();
  const favoritesParam = searchParams.get('favorites') === 'true';

  const [search, setSearch] = useState('');
  const [cookbookId, setCookbookId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState('');
  const [maxPrepTime, setMaxPrepTime] = useState('');
  const [maxCookTime, setMaxCookTime] = useState('');
  const [favorites, setFavorites] = useState(favoritesParam);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedIngredients = useDebounce(selectedIngredients, 400);

  const filters: RecipeFilters = {
    q: debouncedSearch || undefined,
    cookbookId: cookbookId || undefined,
    tags: selectedTags.length ? selectedTags.join(',') : undefined,
    ingredients: debouncedIngredients || undefined,
    maxPrepTime: maxPrepTime ? Number(maxPrepTime) : undefined,
    maxCookTime: maxCookTime ? Number(maxCookTime) : undefined,
    favorites: favorites || undefined,
    page,
    limit: 12,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => recipeApi.list(filters).then((r) => r.data.data!),
  });

  const { data: cookbooksData } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list().then((r) => r.data.data!),
  });

  const toggleTag = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName],
    );
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {favorites ? '❤️ Mes favoris' : 'Mes recettes'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data?.total ?? 0} recette{(data?.total ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/recipes/new">
          <Button leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }>
            Nouvelle recette
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        {/* Search bar */}
        <Input
          placeholder="Rechercher recettes, ingrédients, tags..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Cookbook filter */}
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={cookbookId}
            onChange={(e) => { setCookbookId(e.target.value); setPage(1); }}
          >
            <option value="">Tous les cookbooks</option>
            <option value="personal">Recettes personnelles</option>
            {cookbooksData?.map((cb) => (
              <option key={cb.id} value={cb.id}>{cb.name}</option>
            ))}
          </select>

          {/* Prep time */}
          <Input
            placeholder="Prép. max (min)"
            type="number"
            value={maxPrepTime}
            onChange={(e) => { setMaxPrepTime(e.target.value); setPage(1); }}
          />

          {/* Cook time */}
          <Input
            placeholder="Cuisson max (min)"
            type="number"
            value={maxCookTime}
            onChange={(e) => { setMaxCookTime(e.target.value); setPage(1); }}
          />

          {/* Ingredients */}
          <Input
            placeholder="Ingrédients (séparés par ,)"
            value={selectedIngredients}
            onChange={(e) => { setSelectedIngredients(e.target.value); setPage(1); }}
          />
        </div>

        {/* Tags */}
        {tagsData && tagsData.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagsData.slice(0, 20).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag.name)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Favorites toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={favorites}
              onChange={(e) => { setFavorites(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Favoris uniquement</span>
          </label>

          {(search || cookbookId || selectedTags.length || selectedIngredients || maxPrepTime || maxCookTime || favorites) && (
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              onClick={() => {
                setSearch(''); setCookbookId(''); setSelectedTags([]);
                setSelectedIngredients(''); setMaxPrepTime(''); setMaxCookTime('');
                setFavorites(false); setPage(1);
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* Recipe grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune recette trouvée</h3>
          <p className="text-gray-500 mb-6">
            {search ? `Aucun résultat pour "${search}"` : 'Commencez par créer votre première recette'}
          </p>
          <Link to="/recipes/new">
            <Button>Créer une recette</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.items.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            ← Précédent
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} sur {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === data.totalPages}
          >
            Suivant →
          </Button>
        </div>
      )}
    </div>
  );
}
