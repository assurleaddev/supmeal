import { useLocation, Link } from 'react-router-dom';
import { Paper, Box, Typography } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HomeIcon from '@mui/icons-material/Home';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';

const navItems = [
  { label: 'Accueil', to: '/home', icon: HomeOutlinedIcon, activeIcon: HomeIcon, exact: true },
  { label: 'Recettes', to: '/recipes', icon: MenuBookOutlinedIcon, activeIcon: MenuBookIcon, exact: false },
  { label: 'Cookbooks', to: '/cookbooks', icon: CollectionsBookmarkOutlinedIcon, activeIcon: CollectionsBookmarkIcon, exact: false },
  { label: 'Planning', to: '/meal-planner', icon: CalendarMonthOutlinedIcon, activeIcon: CalendarMonthIcon, exact: false },
  { label: 'Favoris', to: '/recipes?favorites=true', icon: FavoriteBorderIcon, activeIcon: FavoriteIcon, exact: false },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <Paper
      elevation={0}
      sx={{
        display: { xs: 'flex', lg: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(12px)',
        borderRadius: 0,
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map((item) => {
        const isActive = item.exact ? pathname === item.to : pathname.startsWith(item.to.split('?')[0]);
        const Icon = isActive ? item.activeIcon : item.icon;
        return (
          <Box
            key={item.to}
            component={Link}
            to={item.to}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 1,
              gap: 0.3,
              textDecoration: 'none',
              color: isActive ? 'primary.main' : 'text.secondary',
              transition: 'color 0.15s ease',
              minHeight: 56,
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Paper>
  );
}
