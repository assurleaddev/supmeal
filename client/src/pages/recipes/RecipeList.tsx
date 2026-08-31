import { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Grid, Paper, Chip, Button, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { recipeApi, cookbookApi, tagApi, RecipeFilters } from '../../api';
import { useDebounce } from '../../hooks/useDebounce';
import { Input } from '../../components/ui/Input';
import RecipeCard from '../../components/recipes/RecipeCard';

function RecipeCardSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
    >
      <Box className="skeleton" sx={{ height: 180, borderRadius: 0 }} />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box className="skeleton" sx={{ height: 16, width: '80%' }} />
        <Box className="skeleton" sx={{ height: 14, width: '55%' }} />
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
          <Box className="skeleton" sx={{ height: 20, width: 52, borderRadius: '10px' }} />
          <Box className="skeleton" sx={{ height: 20, width: 44, borderRadius: '10px' }} />
        </Box>
      </Box>
    </Paper>
  );
}

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
    setSelectedTags((prev) => prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch(''); setCookbookId(''); setSelectedTags([]); setSelectedIngredients('');
    setMaxPrepTime(''); setMaxCookTime(''); setFavorites(false); setPage(1);
  }, []);

  const hasFilters = search || cookbookId || selectedTags.length || selectedIngredients || maxPrepTime || maxCookTime || favorites;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {favorites ? 'Mes favoris' : 'Mes recettes'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isLoading ? '...' : `${data?.total ?? 0} recette${(data?.total ?? 0) > 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Button component={Link} to="/recipes/new" variant="contained" startIcon={<AddIcon />}>
          Nouvelle recette
        </Button>
      </Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Input
          placeholder="Rechercher recettes, ingrédients, tags..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          leftIcon={<SearchIcon sx={{ fontSize: 18 }} />}
        />

        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Cookbook</InputLabel>
              <Select native label="Cookbook" value={cookbookId} onChange={(e) => { setCookbookId(e.target.value as string); setPage(1); }}>
                <option value="">Tous les cookbooks</option>
                <option value="personal">Recettes personnelles</option>
                {cookbooksData?.map((cb) => <option key={cb.id} value={cb.id}>{cb.name}</option>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <Input
              placeholder="Prép. max (min)"
              type="number"
              value={maxPrepTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setMaxPrepTime(e.target.value); setPage(1); }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <Input
              placeholder="Cuisson max (min)"
              type="number"
              value={maxCookTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setMaxCookTime(e.target.value); setPage(1); }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Input
              placeholder="Ingrédients (séparés par ,)"
              value={selectedIngredients}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSelectedIngredients(e.target.value); setPage(1); }}
            />
          </Grid>
        </Grid>

        {tagsData && tagsData.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {tagsData.slice(0, 20).map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                onClick={() => toggleTag(tag.name)}
                color={selectedTags.includes(tag.name) ? 'primary' : 'default'}
                variant={selectedTags.includes(tag.name) ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={favorites}
                onChange={(e) => { setFavorites(e.target.checked); setPage(1); }}
                color="primary"
              />
            }
            label={<Typography variant="body2">Favoris uniquement</Typography>}
          />
          {hasFilters && (
            <Button
              variant="text"
              size="small"
              startIcon={<FilterListOffIcon />}
              onClick={resetFilters}
              sx={{ color: 'text.secondary', fontWeight: 500 }}
            >
              Réinitialiser
            </Button>
          )}
        </Box>
      </Paper>

      {/* Recipe grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={4} xl={3} key={i}>
              <RecipeCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : data?.items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <RestaurantMenuIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} mb={1}>Aucune recette trouvée</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {search ? `Aucun résultat pour "${search}"` : 'Commencez par créer votre première recette'}
          </Typography>
          {!search && (
            <Button component={Link} to="/recipes/new" variant="contained" startIcon={<AddIcon />}>
              Créer une recette
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {data?.items.map((recipe) => (
            <Grid item xs={12} sm={6} lg={4} xl={3} key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Button variant="outlined" size="small" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Précédent</Button>
          <Typography variant="body2" color="text.secondary">Page {page} / {data.totalPages}</Typography>
          <Button variant="outlined" size="small" onClick={() => setPage((p) => p + 1)} disabled={page === data.totalPages}>Suivant →</Button>
        </Box>
      )}
    </Box>
  );
}
