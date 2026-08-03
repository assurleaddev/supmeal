import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { recipeApi, cookbookApi, mealPlanApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { format, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Box, Typography, Grid, Paper, Chip, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RecipeCard from '../components/recipes/RecipeCard';

const MEAL_LABELS: Record<string, string> = { BREAKFAST: 'Petit-déj', LUNCH: 'Déjeuner', DINNER: 'Dîner', SNACK: 'Encas' };

const STAT_ICONS = [
  { icon: RestaurantMenuIcon, color: '#16a34a', bg: '#f0fdf4' },
  { icon: CollectionsBookmarkIcon, color: '#0ea5e9', bg: '#f0f9ff' },
  { icon: FavoriteIcon, color: '#ef4444', bg: '#fef2f2' },
  { icon: EventNoteIcon, color: '#ea580c', bg: '#fff7ed' },
];

export default function Home() {
  const { user } = useAuthStore();

  const { data: recentRecipes } = useQuery({
    queryKey: ['recipes', { limit: 6, page: 1 }],
    queryFn: () => recipeApi.list({ limit: 6, page: 1 }).then((r) => r.data.data!),
  });

  const { data: cookbooks } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  const { data: mealPlans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => mealPlanApi.list().then((r) => r.data.data!),
  });

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekPlan = mealPlans?.find((p) => p.weekStart.startsWith(format(weekStart, 'yyyy-MM-dd')));
  const todaysMeals = weekPlan?.items.filter((item) => isSameDay(parseISO(item.date), today)) || [];

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const stats = [
    { label: 'Recettes', value: recentRecipes?.total ?? '—', to: '/recipes' },
    { label: 'Cookbooks', value: cookbooks?.length ?? '—', to: '/cookbooks' },
    { label: 'Favoris', value: '—', to: '/recipes?favorites=true' },
    { label: 'Planifiés', value: weekPlan?.items.length ?? 0, to: '/meal-planner' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Welcome banner */}
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #166534 100%)',
          borderRadius: 3,
          border: 'none',
          boxShadow: '0 4px 24px 0 rgba(22,163,74,0.25)',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          },
        }}
      >
        <Typography variant="h5" fontWeight={700} color="white">
          {greeting}, {user?.username} !
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
          {format(today, 'EEEE d MMMM yyyy', { locale: fr })}
        </Typography>

        {todaysMeals.length > 0 ? (
          <Box mt={2}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 1 }}>Au menu aujourd'hui :</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {todaysMeals.map((item) => (
                <Chip
                  key={item.id}
                  label={`${MEAL_LABELS[item.mealType]} : ${item.recipe.title}`}
                  component={Link}
                  to={`/recipes/${item.recipe.id}`}
                  clickable
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' }, fontWeight: 500 }}
                />
              ))}
            </Box>
          </Box>
        ) : (
          <Box mt={2.5} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              component={Link}
              to="/meal-planner"
              variant="contained"
              size="small"
              startIcon={<CalendarMonthIcon />}
              sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)', transform: 'none' }, boxShadow: 'none' }}
            >
              Planifier cette semaine
            </Button>
            <Button
              component={Link}
              to="/recipes/new"
              variant="text"
              size="small"
              startIcon={<AddIcon />}
              sx={{ color: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'none' } }}
            >
              Nouvelle recette
            </Button>
          </Box>
        )}
      </Paper>

      {/* Stats */}
      <Grid container spacing={2}>
        {stats.map((stat, i) => {
          const { icon: Icon, color, bg } = STAT_ICONS[i];
          return (
            <Grid item xs={6} md={3} key={stat.label}>
              <Paper
                component={Link}
                to={stat.to}
                elevation={0}
                sx={{
                  p: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-2px)', borderColor: color },
                }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon sx={{ fontSize: 22, color }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>{stat.label}</Typography>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Recent recipes */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>Recettes récentes</Typography>
          <Typography component={Link} to="/recipes" variant="body2" color="primary" sx={{ textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>Voir tout →</Typography>
        </Box>
        {recentRecipes?.items.length === 0 ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <RestaurantMenuIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
            </Box>
            <Typography color="text.secondary" mb={2.5}>Vous n'avez encore aucune recette</Typography>
            <Button component={Link} to="/recipes/new" variant="contained" startIcon={<AddIcon />}>Créer ma première recette</Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {recentRecipes?.items.slice(0, 6).map((recipe) => (
              <Grid item xs={12} sm={6} lg={4} key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Cookbooks */}
      {(cookbooks?.length ?? 0) > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>Mes cookbooks</Typography>
            <Typography component={Link} to="/cookbooks" variant="body2" color="primary" sx={{ textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>Voir tout →</Typography>
          </Box>
          <Grid container spacing={2}>
            {cookbooks?.slice(0, 3).map((cb) => (
              <Grid item xs={12} sm={6} lg={4} key={cb.id}>
                <Paper
                  component={Link}
                  to={`/cookbooks/${cb.id}`}
                  elevation={0}
                  sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, textDecoration: 'none', transition: 'box-shadow 0.2s, transform 0.2s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}
                >
                  <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MenuBookIcon sx={{ fontSize: 24, color: '#0ea5e9' }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" fontWeight={600} noWrap>{cb.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{cb._count?.recipes ?? 0} recettes · {cb._count?.members ?? 0} membres</Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
