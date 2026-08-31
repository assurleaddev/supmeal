import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Grid, Chip, Button, IconButton,
  Avatar, TextField, FormControl, InputLabel, Select,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { recipeApi, mealPlanApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { MealType } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { useForm } from 'react-hook-form';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Petit-déjeuner', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Encas',
};

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [commentText, setCommentText] = useState('');
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [isFav, setIsFav] = useState<boolean | null>(null);

  const { data: recipeData, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipeApi.get(id!).then((r) => r.data.data!),
  });

  useEffect(() => {
    if (recipeData && isFav === null) setIsFav(recipeData.isFavorite ?? false);
  }, [recipeData]);

  const recipe = recipeData;
  // Droits fournis par le serveur : un EDITOR de cookbook doit pouvoir modifier une recette dont
  // il n'est pas l'auteur, ce que la comparaison createdById masquait (§2.3.1).
  const canEdit = recipe?.permissions?.canEdit ?? false;
  const canDelete = recipe?.permissions?.canDelete ?? false;
  const imageUrl = recipe?.imageUrl
    ? recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_URL}${recipe.imageUrl}`
    : null;

  const handleDelete = async () => {
    if (!confirm('Supprimer cette recette ?')) return;
    try {
      await recipeApi.delete(id!);
      toast.success('Recette supprimée');
      navigate('/recipes');
    } catch { toast.error('Erreur lors de la suppression'); }
  };

  const handleFavorite = async () => {
    try {
      if (isFav) { await recipeApi.unfavorite(id!); setIsFav(false); }
      else { await recipeApi.favorite(id!); setIsFav(true); }
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch { toast.error('Erreur'); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await recipeApi.addComment(id!, commentText);
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      toast.success('Commentaire ajouté');
    } catch { toast.error('Erreur'); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await recipeApi.deleteComment(id!, commentId);
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    } catch { toast.error('Erreur'); }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Paper elevation={0} sx={{ height: 280, borderRadius: 3, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }} />
        <Paper elevation={0} sx={{ height: 40, borderRadius: 2, bgcolor: 'grey.100', width: '50%', border: '1px solid', borderColor: 'divider' }} />
      </Box>
    );
  }

  if (!recipe) return <Typography textAlign="center" py={8} color="text.secondary">Recette introuvable</Typography>;

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back button */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="text" color="inherit" size="small" sx={{ alignSelf: 'flex-start' }}>
        Retour
      </Button>

      {/* Hero card */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
        {imageUrl && (
          <Box sx={{ height: 280, overflow: 'hidden' }}>
            <img src={imageUrl} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        )}
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>{recipe.title}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, color: 'text.secondary' }}>
                <Typography variant="body2">par {recipe.createdBy.username}</Typography>
                {recipe.cookbook && (
                  <>
                    <Typography variant="body2">•</Typography>
                    <Typography component={Link} to={`/cookbooks/${recipe.cookbook.id}`} variant="body2" color="primary" sx={{ textDecoration: 'none' }}>
                      {recipe.cookbook.name}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant={isFav ? 'contained' : 'outlined'}
                size="small"
                startIcon={isFav ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                onClick={handleFavorite}
                color={isFav ? 'error' : 'inherit'}
                sx={!isFav ? { borderColor: 'divider', color: 'text.secondary' } : {}}
              >
                {isFav ? 'Favori' : 'Favoris'}
              </Button>
              <Button variant="outlined" size="small" startIcon={<CalendarMonthIcon />} onClick={() => setPlanModalOpen(true)} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>
                Planifier
              </Button>
              {(canEdit || canDelete) && (
                <>
                  <Button component={Link} to={`/recipes/${id}/edit`} variant="outlined" size="small" startIcon={<EditIcon />} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>
                    Modifier
                  </Button>
                  <Button variant="contained" size="small" startIcon={<DeleteIcon />} color="error" onClick={handleDelete}>
                    Supprimer
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Stats */}
          <Grid container spacing={2} mt={2}>
            {recipe.prepTime && (
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="primary.main">{recipe.prepTime}</Typography>
                  <Typography variant="caption" color="text.secondary">min prép.</Typography>
                </Paper>
              </Grid>
            )}
            {recipe.cookTime && (
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="secondary.main">{recipe.cookTime}</Typography>
                  <Typography variant="caption" color="text.secondary">min cuisson</Typography>
                </Paper>
              </Grid>
            )}
            {totalTime > 0 && (
              <Grid item xs={6} sm={3}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={700}>{totalTime}</Typography>
                  <Typography variant="caption" color="text.secondary">min total</Typography>
                </Paper>
              </Grid>
            )}
            <Grid item xs={6} sm={3}>
              <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={700}>{recipe.portions}</Typography>
                <Typography variant="caption" color="text.secondary">personnes</Typography>
              </Paper>
            </Grid>
          </Grid>

          {recipe.description && <Typography variant="body1" color="text.secondary" mt={2} lineHeight={1.7}>{recipe.description}</Typography>}

          {recipe.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              {recipe.tags.map(({ tag }) => <Chip key={tag.id} label={tag.name} size="small" color="primary" />)}
            </Box>
          )}

          {recipe.sourceUrl && (
            <Button component="a" href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" size="small" startIcon={<OpenInNewIcon />} color="primary" sx={{ mt: 2, textDecoration: 'none' }}>
              Voir la source
            </Button>
          )}
        </Box>
      </Paper>

      {/* Ingredients + Steps */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} mb={2}>🥕 Ingrédients <Typography component="span" variant="body2" color="text.secondary">({recipe.ingredients.length})</Typography></Typography>
            <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recipe.ingredients.map((ri) => (
                <Box component="li" key={ri.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, textTransform: 'capitalize' }}>{ri.ingredient.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ri.quantity && `${ri.quantity}${ri.unit ? ` ${ri.unit}` : ''}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} mb={2}>👨‍🍳 Préparation <Typography component="span" variant="body2" color="text.secondary">({recipe.steps.length} étapes)</Typography></Typography>
            <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recipe.steps.map((step) => (
                <Box component="li" key={step.id} sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {step.orderIndex + 1}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" lineHeight={1.6}>{step.description}</Typography>
                    {step.duration && <Typography variant="caption" color="text.secondary">⏱ {step.duration} min</Typography>}
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Comments */}
      {recipe.cookbook && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>💬 Commentaires ({recipe.comments?.length ?? 0})</Typography>

          <Box component="form" onSubmit={handleComment} sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <TextField
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Ajouter un commentaire..."
              size="small"
              fullWidth
              variant="outlined"
            />
            <Button type="submit" variant="contained" disabled={!commentText.trim()} size="small">Publier</Button>
          </Box>

          {recipe.comments && recipe.comments.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recipe.comments.map((comment) => (
                <Box key={comment.id} sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.50', color: 'primary.main', fontSize: 13, fontWeight: 700 }}>
                    {comment.user.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{comment.user.username}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(comment.createdAt).toLocaleDateString('fr-FR')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mt={0.25}>{comment.content}</Typography>
                  </Box>
                  {comment.userId === user?.id && (
                    <IconButton aria-label="Supprimer ce commentaire" size="small" onClick={() => handleDeleteComment(comment.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>Soyez le premier à commenter !</Typography>
          )}
        </Paper>
      )}

      {/* Plan modal */}
      <AddToPlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        recipeId={id!}
        recipeTitle={recipe.title}
      />
    </Box>
  );
}

function AddToPlanModal({ isOpen, onClose, recipeId, recipeTitle }: {
  isOpen: boolean; onClose: () => void; recipeId: string; recipeTitle: string;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { planId: '', newPlanName: '', date: new Date().toISOString().split('T')[0], mealType: 'LUNCH', portions: 4 },
  });

  const { data: plans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => mealPlanApi.list().then((r) => r.data.data!),
    enabled: isOpen,
  });
  const qc = useQueryClient();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      // Le serveur résout la semaine de la date choisie et réutilise ou crée le planning : aucun
      // calcul de calendrier ici, où le dimanche était systématiquement rattaché à la semaine suivante.
      if (data.planId) {
        await mealPlanApi.addItem(data.planId, { recipeId, date: data.date, mealType: data.mealType as MealType, portions: Number(data.portions) });
      } else {
        await mealPlanApi.schedule({ recipeId, date: data.date, mealType: data.mealType as MealType, portions: Number(data.portions), planName: data.newPlanName || undefined });
      }
      toast.success('Recette ajoutée au planning !');
      qc.invalidateQueries({ queryKey: ['meal-plans'] });
      qc.invalidateQueries({ queryKey: ['meal-plan-week'] });
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter au planning" size="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">Planifier : <strong>{recipeTitle}</strong></Typography>

        <FormControl fullWidth size="small">
          <InputLabel>Planning</InputLabel>
          <Select native label="Planning" {...register('planId')}>
            <option value="">+ Nouveau planning</option>
            {plans?.map((p) => <option key={p.id} value={p.id}>{p.name || `Semaine du ${new Date(p.weekStart).toLocaleDateString('fr-FR')}`}</option>)}
          </Select>
        </FormControl>

        <TextField label="Date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} {...register('date', { required: true })} />

        <FormControl fullWidth size="small">
          <InputLabel>Repas</InputLabel>
          <Select native label="Repas" {...register('mealType')}>
            {Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </FormControl>

        <TextField label="Portions" type="number" size="small" fullWidth inputProps={{ min: 1 }} {...register('portions')} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
          <Button variant="text" color="inherit" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Ajout...' : 'Ajouter'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
