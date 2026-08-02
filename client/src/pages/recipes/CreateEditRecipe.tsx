import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { recipeApi, cookbookApi, tagApi } from '../../api';
import { RecipeFormData } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<RecipeFormData>({
    defaultValues: {
      title: '',
      portions: 4,
      isPersonal: true,
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

  const { data: suggestedTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.list().then((r) => r.data.data!),
  });

  // Load existing recipe for edit
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
        isPersonal: r.isPersonal,
        cookbookId: r.cookbookId ?? undefined,
        ingredients: r.ingredients.map((ri) => ({
          name: ri.ingredient.name,
          quantity: ri.quantity ?? undefined,
          unit: ri.unit ?? '',
          notes: ri.notes ?? '',
          orderIndex: ri.orderIndex,
        })),
        steps: r.steps.map((s) => ({
          description: s.description,
          duration: s.duration ?? undefined,
          orderIndex: s.orderIndex,
        })),
      });
      setTags(r.tags.map((rt) => rt.tag.name));
      setCookbookId(r.cookbookId ?? '');
      if (r.imageUrl) {
        setImagePreview(r.imageUrl.startsWith('http') ? r.imageUrl : `${API_URL}${r.imageUrl}`);
      }
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

  const addTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim();
    if (normalized && !tags.includes(normalized)) {
      setTags((prev) => [...prev, normalized]);
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
        isPersonal: !cookbookId,
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

      // Upload image if selected
      if (imageFile) {
        await recipeApi.uploadImage(recipeId, imageFile);
      }

      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      navigate(`/recipes/${recipeId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Modifier la recette' : 'Nouvelle recette'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Informations générales</h2>

          <Input
            label="Titre de la recette"
            required
            placeholder="Bœuf bourguignon, tarte aux pommes..."
            error={errors.title?.message}
            {...register('title', { required: 'Titre requis' })}
          />

          <Textarea
            label="Description"
            placeholder="Une brève description de la recette..."
            {...register('description')}
          />

          {/* Cookbook assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigner à un cookbook</label>
            <select
              value={cookbookId}
              onChange={(e) => setCookbookId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Recette personnelle</option>
              {cookbooks?.filter((cb) => ['CREATOR', 'EDITOR'].includes(cb.myRole)).map((cb) => (
                <option key={cb.id} value={cb.id}>{cb.name}</option>
              ))}
            </select>
          </div>

          {/* Times & portions */}
          <div className="grid grid-cols-3 gap-4">
            <Input label="Prép. (min)" type="number" min={0} {...register('prepTime', { valueAsNumber: true })} />
            <Input label="Cuisson (min)" type="number" min={0} {...register('cookTime', { valueAsNumber: true })} />
            <Input label="Portions" type="number" min={1} required
              error={errors.portions?.message}
              {...register('portions', { required: true, valueAsNumber: true, min: 1 })} />
          </div>

          <Input label="URL de la source" type="url" placeholder="https://..." {...register('sourceUrl')} />
        </div>

        {/* Image */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Photo</h2>
          <div className="flex items-center gap-4">
            {imagePreview && (
              <div className="w-32 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <div className="text-2xl mb-1">📷</div>
              <p className="text-sm text-gray-500">{imagePreview ? 'Changer la photo' : 'Ajouter une photo'}</p>
              <p className="text-xs text-gray-400">JPG, PNG, WebP — max 5 Mo</p>
            </label>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">🥕 Ingrédients</h2>
            <Button type="button" variant="outline" size="sm"
              onClick={() => addIngredient({ name: '', quantity: undefined, unit: '', notes: '', orderIndex: ingredientFields.length })}>
              + Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {ingredientFields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <Input placeholder="Ingrédient*" {...register(`ingredients.${index}.name`, { required: 'Requis' })}
                    error={errors.ingredients?.[index]?.name?.message} />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Qté" type="number" step="0.01" min={0} {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })} />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Unité" {...register(`ingredients.${index}.unit`)} />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Notes" {...register(`ingredients.${index}.notes`)} />
                </div>
                <button type="button" onClick={() => removeIngredient(index)}
                  className="col-span-1 mt-1 p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">👨‍🍳 Étapes de préparation</h2>
            <Button type="button" variant="outline" size="sm"
              onClick={() => addStep({ description: '', duration: undefined, orderIndex: stepFields.length })}>
              + Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {stepFields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold mt-2">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-5 gap-2">
                  <div className="col-span-4">
                    <Textarea placeholder="Décrivez cette étape..." rows={2}
                      {...register(`steps.${index}.description`, { required: 'Description requise' })}
                      error={errors.steps?.[index]?.description?.message} />
                  </div>
                  <Input type="number" min={0} placeholder="min" {...register(`steps.${index}.duration`, { valueAsNumber: true })} />
                </div>
                <button type="button" onClick={() => removeStep(index)}
                  className="mt-2 p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🏷️ Tags & catégories</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Ajouter un tag..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)}>Ajouter</Button>
          </div>

          {/* Current tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium">
                  {tag}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="hover:bg-primary-200 rounded-full p-0.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Suggested tags */}
          {suggestedTags && (
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.filter((t) => !tags.includes(t.name)).slice(0, 20).map((tag) => (
                <button key={tag.id} type="button" onClick={() => addTag(tag.name)}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-xs transition-colors">
                  + {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" type="button" onClick={() => navigate(-1)}>Annuler</Button>
          <Button type="submit" loading={loading} size="lg">
            {isEditing ? 'Enregistrer les modifications' : 'Créer la recette'}
          </Button>
        </div>
      </form>
    </div>
  );
}
