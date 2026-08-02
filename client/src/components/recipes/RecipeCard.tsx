import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Recipe } from '../../types';
import { recipeApi } from '../../api';
import { Badge } from '../ui/Badge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface RecipeCardProps {
  recipe: Recipe;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const [isFav, setIsFav] = useState(recipe.isFavorite ?? false);
  const queryClient = useQueryClient();

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isFav) {
        await recipeApi.unfavorite(recipe.id);
        setIsFav(false);
        toast.success('Retiré des favoris');
      } else {
        await recipeApi.favorite(recipe.id);
        setIsFav(true);
        toast.success('Ajouté aux favoris');
      }
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch {
      toast.error('Erreur');
    }
  };

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const imageUrl = recipe.imageUrl
    ? recipe.imageUrl.startsWith('http') ? recipe.imageUrl : `${API_URL}${recipe.imageUrl}`
    : null;

  return (
    <Link to={`/recipes/${recipe.id}`} className="group">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 h-full flex flex-col">
        {/* Image */}
        <div className="relative h-44 bg-gradient-to-br from-primary-50 to-accent-50 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-4xl">🍽️</div>
          )}
          {/* Favorite button */}
          <button
            type="button"
            onClick={toggleFavorite}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <svg
              className={`h-4 w-4 transition-colors ${isFav ? 'text-red-500 fill-red-500' : 'text-gray-400'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          {/* Cookbook badge */}
          {recipe.cookbook && (
            <div className="absolute bottom-2 left-2">
              <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full">
                {recipe.cookbook.name}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-primary-700 transition-colors">
            {recipe.title}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {totalTime} min
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {recipe.portions} pers.
            </span>
            {recipe._count && (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {recipe._count.comments}
              </span>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-auto pt-1">
              {recipe.tags.slice(0, 3).map(({ tag }) => (
                <Badge key={tag.id} variant="primary" size="sm">{tag.name}</Badge>
              ))}
              {recipe.tags.length > 3 && (
                <Badge variant="default" size="sm">+{recipe.tags.length - 3}</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
