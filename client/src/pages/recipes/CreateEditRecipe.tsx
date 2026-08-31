import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Grid, Button, IconButton, Chip,
  FormControl, InputLabel, Select,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { recipeApi, cookbookApi, tagApi, userApi } from '../../api';
import { RecipeFormData } from '../../types';
import { Input, Textarea } from '../../components/ui/Input';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function CreateEditRecipe() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cookbookId, setCookbookId] = useState<string>('');

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<RecipeFormData>({
    defaultValues: {
      title: '',
      portions: 4,
      ingredients: [{ name: '', quantity: undefined, unit: '', notes: '', orderIndex: 0 }],
      steps: [{ description: '', duration: undefined, orderIndex: 0 }],
    },
  });

  const { fields: ingredientFields, append: addIngredient, remove: removeIngredient } = useFieldArray({ control, name: 'ingredients' });
  const { fields: stepFields, append: addStep, remove: removeStep } = useFieldArray({ control, name: 'steps' });

  const { data: cookbooks } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  // Le nombre de portions par défaut vient des préférences de l'utilisateur (§2.2.5) : il était
  // auparavant figé à 4, ce qui rendait la préférence inopérante.
  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => userApi.getMe().then((r) => r.data.data!),
    enabled: !isEditing,
  });

  useEffect(() => {
    if (isEditing) return;
    const preferred = profile?.preferences?.defaultPortions;
    if (preferred) setValue('portions', preferred);
  }, [isEditing, profile, setValue]);

  const { data: suggestedTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list().then((r) => r.data.data!),
  });

  useEffect(() => {
    if (!isEditing || !id) return;
    recipeApi.get(id).then((res) => {
      const r = res.data.data!;
      reset({
        title: r.title,
        description: r.description ?? '',
        prepTime: r.prepTime ?? undefined,
        cookTime: r.cookTime ?? undefined,
        portions: r.portions,
        sourceUrl: r.sourceUrl ?? '',
        cookbookId: r.cookbookId ?? undefined,
        ingredients: r.ingredients.map((ri) => ({ name: ri.ingredient.name, quantity: ri.quantity ?? undefined, unit: ri.unit ?? '', notes: ri.notes ?? '', orderIndex: ri.orderIndex })),
        steps: r.steps.map((s) => ({ description: s.description, duration: s.duration ?? undefined, orderIndex: s.orderIndex })),
      });
      setTags(r.tags.map((rt) => rt.tag.name));
      setCookbookId(r.cookbookId ?? '');
      if (r.imageUrl) setImagePreview(r.imageUrl.startsWith('http') ? r.imageUrl : `${API_URL}${r.imageUrl}`);
    });
  }, [isEditing, id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Les tags sont envoyés tels que saisis : leur canonicalisation (minuscules, trim, déduplication
  // en base) est une règle métier appliquée par le serveur. On ne filtre ici que la saisie vide et
  // la répétition immédiate, qui relèvent de l'affichage de la liste de puces.
  const addTag = (tagName: string) => {
    const value = tagName.trim();
    if (value && !tags.some((t) => t.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0)) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput('');
  };

  const onSubmit = async (data: RecipeFormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        tags,
        cookbookId: cookbookId || undefined,
        ingredients: data.ingredients.map((ing, i) => ({ ...ing, orderIndex: i })),
        steps: data.steps.map((step, i) => ({ ...step, orderIndex: i })),
      };
      let recipeId: string;
      if (isEditing && id) {
        await recipeApi.update(id, payload);
        recipeId = id;
        toast.success('Recette mise à jour !');
      } else {
        const res = await recipeApi.create(payload);
        recipeId = res.data.data!.id;
        toast.success('Recette créée !');
      }
      if (imageFile) await recipeApi.uploadImage(recipeId, imageFile);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      navigate(`/recipes/${recipeId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton aria-label="Revenir à la page précédente" onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700}>{isEditing ? 'Modifier la recette' : 'Nouvelle recette'}</Typography>
      </Box>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Basic info */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" fontWeight={600}>Informations générales</Typography>
          <Input label="Titre de la recette *" placeholder="Bœuf bourguignon, tarte aux pommes..." error={errors.title?.message} {...register('title', { required: 'Titre requis' })} />
          <Textarea label="Description" placeholder="Une brève description de la recette..." {...register('description')} />

          <FormControl fullWidth size="small">
            <InputLabel>Assigner à un cookbook</InputLabel>
            <Select native label="Assigner à un cookbook" value={cookbookId} onChange={(e) => setCookbookId(e.target.value as string)}>
              <option value="">Recette personnelle</option>
              {cookbooks?.filter((cb) => cb.permissions.canEditRecipes).map((cb) => (
                <option key={cb.id} value={cb.id}>{cb.name}</option>
              ))}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid item xs={4}><Input label="Prép. (min)" type="number" inputProps={{ min: 0 }} {...register('prepTime', { valueAsNumber: true })} /></Grid>
            <Grid item xs={4}><Input label="Cuisson (min)" type="number" inputProps={{ min: 0 }} {...register('cookTime', { valueAsNumber: true })} /></Grid>
            <Grid item xs={4}><Input label="Portions *" type="number" inputProps={{ min: 1 }} error={errors.portions?.message} {...register('portions', { required: true, valueAsNumber: true, min: 1 })} /></Grid>
          </Grid>

          <Input label="URL de la source" type="url" placeholder="https://..." {...register('sourceUrl')} />
        </Paper>

        {/* Image */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Photo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {imagePreview && (
              <Box sx={{ width: 120, height: 88, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
            <Box
              component="label"
              sx={{ flex: 1, border: '2px dashed', borderColor: 'divider', borderRadius: 3, p: 3, textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}
            >
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
              <Typography fontSize={28} mb={0.5}>📷</Typography>
              <Typography variant="body2" color="text.secondary">{imagePreview ? 'Changer la photo' : 'Ajouter une photo'}</Typography>
              <Typography variant="caption" color="text.disabled">JPG, PNG, WebP — max 5 Mo</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Ingredients */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>🥕 Ingrédients</Typography>
            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />}
              onClick={() => addIngredient({ name: '', quantity: undefined, unit: '', notes: '', orderIndex: ingredientFields.length })}>
              Ajouter
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {ingredientFields.map((field, index) => (
              <Grid container spacing={1} key={field.id} alignItems="flex-start">
                <Grid item xs={5}><Input placeholder="Ingrédient *" error={errors.ingredients?.[index]?.name?.message} {...register(`ingredients.${index}.name`, { required: 'Requis' })} /></Grid>
                <Grid item xs={2}><Input placeholder="Qté" type="number" inputProps={{ step: '0.01', min: 0 }} {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })} /></Grid>
                <Grid item xs={2}><Input placeholder="Unité" {...register(`ingredients.${index}.unit`)} /></Grid>
                <Grid item xs={2}><Input placeholder="Notes" {...register(`ingredients.${index}.notes`)} /></Grid>
                <Grid item xs={1} sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
                  <IconButton aria-label={`Supprimer l'ingrédient ${index + 1}`} size="small" onClick={() => removeIngredient(index)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
          </Box>
        </Paper>

        {/* Steps */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>👨‍🍳 Étapes de préparation</Typography>
            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />}
              onClick={() => addStep({ description: '', duration: undefined, orderIndex: stepFields.length })}>
              Ajouter
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {stepFields.map((field, index) => (
              <Box key={field.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, mt: 0.5 }}>
                  {index + 1}
                </Box>
                <Grid container spacing={1} sx={{ flex: 1 }}>
                  <Grid item xs={10}>
                    <Textarea placeholder="Décrivez cette étape..." rows={2} error={errors.steps?.[index]?.description?.message} {...register(`steps.${index}.description`, { required: 'Description requise' })} />
                  </Grid>
                  <Grid item xs={2}>
                    <Input type="number" inputProps={{ min: 0 }} placeholder="min" {...register(`steps.${index}.duration`, { valueAsNumber: true })} />
                  </Grid>
                </Grid>
                <IconButton aria-label={`Supprimer l'étape ${index + 1}`} size="small" onClick={() => removeStep(index)} sx={{ mt: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Tags */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>🏷️ Tags & catégories</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Input
              placeholder="Ajouter un tag..."
              value={tagInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
              sx={{ flex: 1 }}
            />
            <Button type="button" variant="outlined" size="small" onClick={() => addTag(tagInput)}>Ajouter</Button>
          </Box>

          {tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {tags.map((tag) => (
                <Chip key={tag} label={tag} color="primary" size="small" onDelete={() => setTags((prev) => prev.filter((t) => t !== tag))} />
              ))}
            </Box>
          )}

          {suggestedTags && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {suggestedTags.filter((t) => !tags.includes(t.name)).slice(0, 20).map((tag) => (
                <Chip key={tag.id} label={`+ ${tag.name}`} size="small" variant="outlined" onClick={() => addTag(tag.name)} sx={{ cursor: 'pointer' }} />
              ))}
            </Box>
          )}
        </Paper>

        {/* Submit */}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button type="button" variant="text" color="inherit" onClick={() => navigate(-1)}>Annuler</Button>
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? 'Enregistrement...' : (isEditing ? 'Enregistrer les modifications' : 'Créer la recette')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
