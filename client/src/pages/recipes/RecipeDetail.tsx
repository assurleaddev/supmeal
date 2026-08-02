import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { recipeApi, mealPlanApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { MealType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useForm } from 'react-hook-form';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  SNACK: 'Encas',
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
    onSuccess: (data) => { if (isFav === null) setIsFav(data.isFavorite ?? false); },
  } as any);

  const recipe = recipeData;
  const isOwner = recipe?.createdById === user?.id;
  const imageUrl = recipe?.imageUrl
    ? recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_URL}${recipe.imageUrl}`
    : null;

  const handleDelete = async () => {
    if (!confirm('Supprimer cette recette ?')) return;
    try {
      await recipeApi.delete(id!);
      toast.success('Recette supprimée');
      navigate('/recipes');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleFavorite = async () => {
    try {
      if (isFav) {
        await recipeApi.unfavorite(id!);
        setIsFav(false);
      } else {
        await recipeApi.favorite(id!);
        setIsFav(true);
      }
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
      <div className="space-y-4">
        <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!recipe) {
    return <div className="text-center py-16 text-gray-500">Recette introuvable</div>;
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Retour
      </button>

      {/* Hero */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-card">
        {imageUrl && (
          <div className="h-72 overflow-hidden">
            <img src={imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">{recipe.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                <span>par {recipe.createdBy.username}</span>
                {recipe.cookbook && (
                  <>
                    <span>•</span>
                    <Link to={`/cookbooks/${recipe.cookbook.id}`} className="text-primary-600 hover:underline">
                      {recipe.cookbook.name}
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleFavorite}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isFav ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-300 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <svg className={`h-4 w-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {isFav ? 'Favori' : 'Favoris'}
              </button>
              <Button variant="outline" size="sm" onClick={() => setPlanModalOpen(true)}>
                📅 Planifier
              </Button>
              {isOwner && (
                <>
                  <Link to={`/recipes/${id}/edit`}>
                    <Button variant="outline" size="sm">✏️ Modifier</Button>
                  </Link>
                  <Button variant="danger" size="sm" onClick={handleDelete}>🗑️ Supprimer</Button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {recipe.prepTime && (
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-primary-600">{recipe.prepTime}</div>
                <div className="text-xs text-gray-500 mt-0.5">min prép.</div>
              </div>
            )}
            {recipe.cookTime && (
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-accent-600">{recipe.cookTime}</div>
                <div className="text-xs text-gray-500 mt-0.5">min cuisson</div>
              </div>
            )}
            {totalTime > 0 && (
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-700">{totalTime}</div>
                <div className="text-xs text-gray-500 mt-0.5">min total</div>
              </div>
            )}
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-gray-700">{recipe.portions}</div>
              <div className="text-xs text-gray-500 mt-0.5">personnes</div>
            </div>
          </div>

          {/* Description */}
          {recipe.description && (
            <p className="mt-4 text-gray-600 leading-relaxed">{recipe.description}</p>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {recipe.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="primary">{tag.name}</Badge>
              ))}
            </div>
          )}

          {/* Source */}
          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline mt-4">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Voir la source
            </a>
          )}
        </div>
      </div>

      {/* Ingredients + Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ingredients */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🥕 Ingrédients <span className="text-sm font-normal text-gray-500">({recipe.ingredients.length})</span>
          </h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ri) => (
              <li key={ri.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
                <span className="flex-1 text-gray-700 capitalize">{ri.ingredient.name}</span>
                <span className="text-sm text-gray-500">
                  {ri.quantity && `${ri.quantity}${ri.unit ? ` ${ri.unit}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            👨‍🍳 Préparation <span className="text-sm font-normal text-gray-500">({recipe.steps.length} étapes)</span>
          </h2>
          <ol className="space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
                  {step.orderIndex + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-700 leading-relaxed">{step.description}</p>
                  {step.duration && (
                    <span className="text-xs text-gray-400 mt-1">⏱ {step.duration} min</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Comments */}
      {recipe.cookbook && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            💬 Commentaires ({recipe.comments?.length ?? 0})
          </h2>

          <form onSubmit={handleComment} className="flex gap-3 mb-6">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button type="submit" size="sm" disabled={!commentText.trim()}>Publier</Button>
          </form>

          {recipe.comments && recipe.comments.length > 0 ? (
            <div className="space-y-4">
              {recipe.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-sm font-semibold">
                      {comment.user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{comment.user.username}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{comment.content}</p>
                  </div>
                  {comment.userId === user?.id && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Soyez le premier à commenter !</p>
          )}
        </div>
      )}

      {/* Plan modal */}
      <AddToPlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        recipeId={id!}
        recipeTitle={recipe.title}
      />
    </div>
  );
}

function AddToPlanModal({ isOpen, onClose, recipeId, recipeTitle }: {
  isOpen: boolean; onClose: () => void; recipeId: string; recipeTitle: string;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      planId: '',
      newPlanName: '',
      date: new Date().toISOString().split('T')[0],
      mealType: 'LUNCH',
      portions: 4,
    },
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
      let planId = data.planId;
      if (!planId) {
        const weekStart = new Date(data.date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const newPlan = await mealPlanApi.create({
          name: data.newPlanName || `Planning semaine du ${weekStart.toLocaleDateString('fr-FR')}`,
          weekStart: weekStart.toISOString().split('T')[0],
        });
        planId = newPlan.data.data!.id;
      }
      await mealPlanApi.addItem(planId, {
        recipeId,
        date: data.date,
        mealType: data.mealType as MealType,
        portions: Number(data.portions),
      });
      toast.success('Recette ajoutée au planning !');
      qc.invalidateQueries({ queryKey: ['meal-plans'] });
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-gray-600">Planifier : <strong>{recipeTitle}</strong></p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Planning</label>
          <select {...register('planId')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">+ Nouveau planning</option>
            {plans?.map((p) => (
              <option key={p.id} value={p.id}>{p.name || `Semaine du ${new Date(p.weekStart).toLocaleDateString('fr-FR')}`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" {...register('date', { required: true })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Repas</label>
          <select {...register('mealType')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Portions</label>
          <input type="number" min={1} {...register('portions')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={loading}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}
