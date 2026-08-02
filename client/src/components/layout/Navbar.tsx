import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Box, Typography, IconButton, Avatar, Menu, MenuItem,
  ListItemIcon, ListItemText, Divider, Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../../store/authStore';
import { disconnectSocket } from '../../hooks/useSocket';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setAnchorEl(null);
    disconnectSocket();
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', zIndex: 40 }}>
      <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, minHeight: 64 }}>
        {/* Logo */}
        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', mr: 'auto' }}>
          <Box sx={{ width: 32, height: 32, bgcolor: 'primary.main', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="white" fontWeight={700} fontSize={18}>S</Typography>
          </Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">SUPMEAL</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Quick add */}
          <Button
            component={Link}
            to="/recipes/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            Recette
          </Button>

          {/* User avatar button */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar
              src={user?.avatar ?? undefined}
              sx={{ width: 34, height: 34, bgcolor: 'primary.light', color: 'primary.dark', fontSize: 14, fontWeight: 700 }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </Box>

        {/* Dropdown menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 180, mt: 0.5 } }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>{user?.username}</Typography>
          </Box>
          <Divider />
          <MenuItem component={Link} to="/settings" onClick={() => setAnchorEl(null)}>
            <ListItemIcon><SettingsOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Paramètres</ListItemText>
          </MenuItem>
          <MenuItem component={Link} to="/data" onClick={() => setAnchorEl(null)}>
            <ListItemIcon><DownloadOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Import / Export</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
            <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Déconnexion</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
