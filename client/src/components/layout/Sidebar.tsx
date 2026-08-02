import { NavLink } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

const navItems = [
  { label: 'Accueil',      to: '/',                    icon: <HomeOutlinedIcon />,         exact: true  },
  { label: 'Mes recettes', to: '/recipes',              icon: <MenuBookOutlinedIcon />,     exact: false },
  { label: 'Cookbooks',    to: '/cookbooks',            icon: <LibraryBooksOutlinedIcon />, exact: false },
  { label: 'Planning',     to: '/meal-planner',         icon: <CalendarMonthOutlinedIcon />,exact: false },
  { label: 'Favoris',      to: '/recipes?favorites=true', icon: <FavoriteBorderIcon />,    exact: false },
];

export default function Sidebar() {
  return (
    <Box
      component="aside"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        width: 220,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: 1,
        flexShrink: 0,
      }}
    >
      <List dense disablePadding>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.exact} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '&:hover': { bgcolor: 'primary.50' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 600 : 500 }} />
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>
    </Box>
  );
}
