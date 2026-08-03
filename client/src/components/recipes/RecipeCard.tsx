import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Card, CardMedia, CardContent, CardActionArea, Box, Typography,
  IconButton, Chip, Tooltip,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { Recipe } from '../../types';
import { recipeApi } from '../../api';

const API_URL = import.meta.env.VITE_API_URL ?? '';

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
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 4px 0 rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease',
        '&:hover': {
          boxShadow: '0 8px 28px 0 rgba(0,0,0,0.11)',
          transform: 'translateY(-3px)',
          borderColor: 'primary.light',
          '& .recipe-image': { transform: 'scale(1.04)' },
        },
      }}
    >
      <CardActionArea component={Link} to={`/recipes/${recipe.id}`} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Image */}
        <Box sx={{ position: 'relative', height: 180, bgcolor: 'grey.100', flexShrink: 0, overflow: 'hidden' }}>
          {imageUrl ? (
            <CardMedia
              component="img"
              image={imageUrl}
              alt={recipe.title}
              className="recipe-image"
              sx={{ height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
            />
          ) : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
              <RestaurantMenuIcon sx={{ fontSize: 44, color: 'grey.300' }} />
            </Box>
          )}
          {/* Cookbook badge */}
          {recipe.cookbook && (
            <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
              <Chip
                label={recipe.cookbook.name}
                size="small"
                sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, height: 22, backdropFilter: 'blur(4px)' }}
              />
            </Box>
          )}
        </Box>

        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, pt: 1.5, pb: '12px !important' }}>
          <Typography
            variant="body1"
            fontWeight={600}
            sx={{ lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {recipe.title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            {totalTime > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <AccessTimeIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">{totalTime} min</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <PeopleOutlineIcon sx={{ fontSize: 13 }} />
              <Typography variant="caption">{recipe.portions} pers.</Typography>
            </Box>
            {recipe._count && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">{recipe._count.comments}</Typography>
              </Box>
            )}
          </Box>

          {recipe.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: 0.5 }}>
              {recipe.tags.slice(0, 3).map(({ tag }) => (
                <Chip key={tag.id} label={tag.name} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
              ))}
              {recipe.tags.length > 3 && (
                <Chip label={`+${recipe.tags.length - 3}`} size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'grey.100' }} />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* Favorite button */}
      <Tooltip title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
        <IconButton
          onClick={toggleFavorite}
          size="small"
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'white', transform: 'scale(1.1)' },
          }}
        >
          {isFav
            ? <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
            : <FavoriteBorderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          }
        </IconButton>
      </Tooltip>
    </Card>
  );
}
