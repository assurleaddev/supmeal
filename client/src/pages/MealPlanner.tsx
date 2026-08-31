import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Button, Chip, TextField, IconButton, Divider,
  FormControl, InputLabel, Select,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { mealPlanApi, recipeApi, cookbookApi } from '../api';
import { MealType, MealPlanItem, Recipe } from '../types';
import { Modal } from '../components/ui/Modal';

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const MEAL_LABELS: Record<MealType, string> = { BREAKFAST: 'Petit-déjeuner', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Encas' };
const MEAL_ICONS: Record<MealType, string> = { BREAKFAST: '☀️', LUNCH: '🌞', DINNER: '🌙', SNACK: '🍎' };
const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function MealPlanner() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shareCookbookId, setShareCookbookId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemTarget, setAddItemTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const queryClient = useQueryClient();

  // Les bornes de la semaine, ses 7 jours et la date du jour viennent du serveur : le client ne
  // fait aucune arithmétique de calendrier, il ne transmet qu'un décalage en semaines (§2.3.1).
  const { data: week } = useQuery({
    queryKey: ['meal-plan-week', weekOffset],
    queryFn: () => mealPlanApi.week(weekOffset).then((r) => r.data.data!),
  });

  const weekDays = week?.days ?? [];
  const isToday = (day: string) => day === week?.today;

  const refreshPlanning = () => {
    queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
    queryClient.invalidateQueries({ queryKey: ['meal-plan-week'] });
  };

  // Les cookbooks où l'utilisateur peut écrire : un planning peut y être rattaché pour être
  // partagé avec les autres membres (§2.1 « planifier des repas ensemble »).
  const { data: cookbooks } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  const shareableCookbooks = (cookbooks ?? []).filter((cb) => cb.permissions.canEditRecipes);

  const { data: plans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => mealPlanApi.list().then((r) => r.data.data!),
  });

  const currentPlan = selectedPlanId ? plans?.find((p) => p.id === selectedPlanId) : week?.plan ?? undefined;

  const { data: shoppingList } = useQuery({
    queryKey: ['shopping-list', currentPlan?.id],
    queryFn: () => mealPlanApi.getShoppingList(currentPlan!.id).then((r) => r.data.data!),
    enabled: shoppingListOpen && Boolean(currentPlan?.id),
  });

  // Les suggestions dépendent du créneau : le serveur y ajuste le budget de temps, écarte les
  // allergènes déclarés et privilégie les ingrédients déjà prévus dans la semaine.
  const { data: suggestionData, isFetching: suggesting } = useQuery({
    queryKey: ['suggestions', addItemTarget?.date, addItemTarget?.mealType],
    queryFn: () =>
      recipeApi
        .suggestions({ date: addItemTarget!.date, mealType: addItemTarget!.mealType, limit: 3 })
        .then((r) => r.data.data!),
    enabled: addItemOpen && Boolean(addItemTarget),
  });

  const { data: recipesData } = useQuery({
    queryKey: ['recipes', { q: recipeSearch, limit: 10 }],
    queryFn: () => recipeApi.list({ q: recipeSearch || undefined, limit: 10 }).then((r) => r.data.data!),
    enabled: addItemOpen,
  });

  const handleCreatePlan = async () => {
    try {
      if (!week) return;
      const res = await mealPlanApi.create({
        name: week.defaultName,
        weekStart: week.weekStart,
        cookbookId: shareCookbookId || null,
      });
      setSelectedPlanId(res.data.data!.id);
      refreshPlanning();
      toast.success('Planning créé !');
    } catch { toast.error('Erreur'); }
  };

  /**
   * Une suggestion ne porte que l'identifiant et le titre. La sélection a besoin de l'objet complet,
   * qu'on récupère au besoin plutôt que de faire renvoyer la recette entière par les suggestions.
   */
  const pickSuggestion = async (recipeId: string) => {
    const known = recipesData?.items.find((r) => r.id === recipeId);
    if (known) { setSelectedRecipe(known); return; }
    try {
      const { data } = await recipeApi.get(recipeId);
      setSelectedRecipe(data.data!);
    } catch {
      toast.error('Recette introuvable');
    }
  };

  const handleAddItem = async () => {
    if (!addItemTarget || !selectedRecipe || !currentPlan) return;
    try {
      await mealPlanApi.addItem(currentPlan.id, { recipeId: selectedRecipe.id, date: addItemTarget.date, mealType: addItemTarget.mealType });
      refreshPlanning();
      toast.success('Ajouté au planning !');
      setAddItemOpen(false);
      setSelectedRecipe(null);
      setRecipeSearch('');
    } catch { toast.error('Erreur'); }
  };

  const handleRemoveItem = async (planId: string, itemId: string) => {
    try {
      await mealPlanApi.removeItem(planId, itemId);
      refreshPlanning();
    } catch { toast.error('Erreur'); }
  };

  const getItemsFor = (day: string, mealType: MealType): MealPlanItem[] => {
    if (!currentPlan) return [];
    return currentPlan.items.filter((item) => item.date.slice(0, 10) === day && item.mealType === mealType);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Planning de repas</Typography>
          <Typography variant="body2" color="text.secondary">{week?.defaultName ?? '…'}</Typography>
          {currentPlan?.cookbook && (
            <Chip
              size="small"
              icon={<GroupsIcon sx={{ fontSize: 16 }} />}
              label={`Partagé — ${currentPlan.cookbook.name}`}
              sx={{ mt: 0.75, bgcolor: 'primary.50', color: 'primary.dark', fontWeight: 600 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" size="small" startIcon={<ChevronLeftIcon />} onClick={() => { setWeekOffset((o) => o - 1); setSelectedPlanId(null); }} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Préc.</Button>
          <Button variant="outlined" size="small" startIcon={<TodayIcon />} onClick={() => { setWeekOffset(0); setSelectedPlanId(null); }} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Aujourd'hui</Button>
          <Button variant="outlined" size="small" endIcon={<ChevronRightIcon />} onClick={() => { setWeekOffset((o) => o + 1); setSelectedPlanId(null); }} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Suiv.</Button>
          {currentPlan && <Button variant="contained" size="small" startIcon={<ShoppingCartIcon />} onClick={() => setShoppingListOpen(true)}>Liste de courses</Button>}
        </Box>
      </Box>

      {/* Plan selector */}
      {plans && plans.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {plans.map((p) => (
            <Chip
              key={p.id}
              label={p.name || `Semaine du ${format(parseISO(p.weekStart), 'd MMM', { locale: fr })}`}
              onClick={() => setSelectedPlanId(p.id)}
              color={currentPlan?.id === p.id ? 'primary' : 'default'}
              variant={currentPlan?.id === p.id ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      {/* Create plan CTA */}
      {!currentPlan && (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Typography fontSize={48} mb={1}>📅</Typography>
          <Typography variant="h6" fontWeight={600} mb={0.5}>Aucun planning pour cette semaine</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>Créez un planning pour organiser vos repas</Typography>

          {/* Rattacher le planning à un cookbook le rend visible et modifiable par ses membres,
              ce qui est la forme que prend « planifier des repas ensemble » (§2.1). */}
          {shareableCookbooks.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 260, mb: 2, display: 'block', mx: 'auto', maxWidth: 320 }}>
              <InputLabel shrink>Partager avec un cookbook</InputLabel>
              <Select
                native
                notched
                label="Partager avec un cookbook"
                value={shareCookbookId}
                onChange={(e) => setShareCookbookId(e.target.value as string)}
                fullWidth
              >
                <option value="">Planning personnel</option>
                {shareableCookbooks.map((cb) => (
                  <option key={cb.id} value={cb.id}>{cb.name}</option>
                ))}
              </Select>
            </FormControl>
          )}

          <Button variant="contained" onClick={handleCreatePlan}>
            {shareCookbookId ? 'Créer le planning partagé' : 'Créer le planning de la semaine'}
          </Button>
        </Paper>
      )}

      {/* Weekly grid.
          Sept colonnes ne tiennent pas sur un téléphone : la grille défile horizontalement plutôt
          que d'être rognée par un overflow caché, qui rendait les derniers jours inatteignables. */}
      {currentPlan && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflowX: 'auto', overflowY: 'hidden' }}>
          <Box sx={{ minWidth: { xs: 640, md: 0 } }}>
          {/* Day headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: 'divider' }}>
            {weekDays.map((day) => (
              <Box key={day} sx={{ textAlign: 'center', py: 1.5, px: 1, borderRight: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 'none' }, bgcolor: isToday(day) ? 'primary.50' : 'transparent' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {format(parseISO(day), 'EEE', { locale: fr })}
                </Typography>
                <Typography variant="body1" fontWeight={700} color={isToday(day) ? 'primary.main' : 'text.primary'}>
                  {format(parseISO(day), 'd')}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Meal rows */}
          {MEAL_TYPES.map((mealType) => (
            <Box key={mealType} sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
              {/* Le libellé coiffe sa ligne. Rendu après les cellules, il paraissait désigner la
                  ligne suivante et l'on ne savait plus quel repas on remplissait. */}
              <Box sx={{ bgcolor: 'grey.50', px: 2, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{MEAL_ICONS[mealType]} {MEAL_LABELS[mealType]}</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map((day) => {
                  const items = getItemsFor(day, mealType);
                  return (
                    <Box
                      key={day}
                      sx={{ minHeight: 90, p: 1, borderRight: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 'none' }, bgcolor: isToday(day) ? 'rgba(22, 163, 74, 0.03)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                    >
                      {items.map((item) => (
                        <Box
                          key={item.id}
                          sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100', borderRadius: 1.5, p: 0.75, position: 'relative' }}
                        >
                          <Typography variant="caption" fontWeight={600} color="primary.dark" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                            {item.recipe.title}
                          </Typography>
                          {/* Auparavant `display: none` révélé au seul `:hover` : inatteignable au
                              doigt comme au clavier. Toujours rendu, simplement atténué. */}
                          <IconButton
                            aria-label={`Retirer ${item.recipe.title} du planning`}
                            size="small"
                            onClick={() => handleRemoveItem(currentPlan.id, item.id)}
                            sx={{
                              position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                              bgcolor: 'error.main', color: 'white', opacity: { xs: 1, md: 0.35 },
                              transition: 'opacity 120ms',
                              '&:hover, &:focus-visible': { opacity: 1, bgcolor: 'error.dark' },
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 10 }} />
                          </IconButton>
                        </Box>
                      ))}
                      <Box
                        sx={{ cursor: 'pointer', borderRadius: 1, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', '&:hover': { color: 'primary.main', bgcolor: 'primary.50' } }}
                        onClick={() => { setAddItemTarget({ date: day, mealType }); setAddItemOpen(true); }}
                      >
                        <AddIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontSize: 11 }}>{MEAL_ICONS[mealType]}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
          </Box>
        </Paper>
      )}

      {/* Add item modal */}
      <Modal isOpen={addItemOpen} onClose={() => { setAddItemOpen(false); setSelectedRecipe(null); setRecipeSearch(''); }} title="Ajouter une recette" size="md">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {addItemTarget && (
            <Typography variant="body2" color="text.secondary">
              {MEAL_ICONS[addItemTarget.mealType]} {MEAL_LABELS[addItemTarget.mealType]} — <strong>{format(addItemTarget.date, 'EEEE d MMMM', { locale: fr })}</strong>
            </Typography>
          )}

          {/* Suggestions : proposées d'abord, la recherche manuelle reste juste en dessous. */}
          {(suggesting || (suggestionData?.suggestions.length ?? 0) > 0) && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <AutoAwesomeIcon sx={{ fontSize: 17, color: 'secondary.main' }} />
                <Typography variant="body2" fontWeight={600}>Suggestions pour ce créneau</Typography>
              </Box>

              {suggesting && (
                <Typography variant="caption" color="text.secondary">Analyse de vos habitudes…</Typography>
              )}

              {suggestionData?.basis.relaxed && (
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Toutes vos recettes sont déjà au planning de la semaine — voici celles qui y figurent déjà.
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {suggestionData?.suggestions.map((suggestion) => {
                  const isSelected = selectedRecipe?.id === suggestion.recipeId;
                  return (
                    <Box
                      key={suggestion.recipeId}
                      role="button"
                      tabIndex={0}
                      onClick={() => pickSuggestion(suggestion.recipeId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          pickSuggestion(suggestion.recipeId);
                        }
                      }}
                      sx={{
                        px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer',
                        border: '1px solid', borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected ? 'primary.50' : 'transparent',
                        '&:hover': { borderColor: 'primary.light' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>{suggestion.title}</Typography>
                        {suggestion.alreadyInWeek && (
                          <Chip label="déjà prévue" size="small" sx={{ height: 18, fontSize: 10 }} />
                        )}
                      </Box>
                      {/* La justification est le cœur de l'intérêt : une suggestion inexpliquée
                          ne se distingue pas d'un tirage au hasard. */}
                      {suggestion.reasons.map((reason) => (
                        <Typography key={reason.code} variant="caption" color="text.secondary" display="block">
                          · {reason.label}
                        </Typography>
                      ))}
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">ou choisir soi-même</Typography>
              </Divider>
            </Box>
          )}

          <TextField
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder="Rechercher une recette..."
            size="small"
            fullWidth
            variant="outlined"
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 240, overflowY: 'auto' }}>
            {recipesData?.items.map((recipe) => {
              const isSelected = selectedRecipe?.id === recipe.id;
              return (
                <Box
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer', border: '1px solid', borderColor: isSelected ? 'primary.main' : 'transparent', bgcolor: isSelected ? 'primary.50' : 'transparent', '&:hover': { bgcolor: isSelected ? 'primary.50' : 'grey.50' } }}
                >
                  <Box sx={{ width: 40, height: 32, borderRadius: 1, bgcolor: 'grey.100', overflow: 'hidden', flexShrink: 0 }}>
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_URL}${recipe.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🍽</Box>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{recipe.title}</Typography>
                    {recipe.prepTime && <Typography variant="caption" color="text.secondary">{recipe.prepTime} min prép.</Typography>}
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button variant="text" color="inherit" onClick={() => setAddItemOpen(false)}>Annuler</Button>
            <Button variant="contained" onClick={handleAddItem} disabled={!selectedRecipe}>Ajouter</Button>
          </Box>
        </Box>
      </Modal>

      {/* Shopping list modal */}
      <Modal isOpen={shoppingListOpen} onClose={() => setShoppingListOpen(false)} title="🛒 Liste de courses" size="md">
        <Box>
          {!shoppingList ? (
            <Typography textAlign="center" py={4} color="text.secondary">Chargement...</Typography>
          ) : shoppingList.length === 0 ? (
            <Typography textAlign="center" py={4} color="text.secondary">Aucun ingrédient pour cette semaine</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" mb={2}>{shoppingList.length} ingrédient{shoppingList.length > 1 ? 's' : ''} à acheter</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {shoppingList.map((item, i) => (
                  <Box key={i}>
                    {i > 0 && <Divider />}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                      <Box sx={{ width: 16, height: 16, border: '2px solid', borderColor: 'divider', borderRadius: 0.5, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1, textTransform: 'capitalize' }}>{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.totalQuantity !== null && `${Math.round(item.totalQuantity * 100) / 100}`}
                        {item.unit && ` ${item.unit}`}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
}
