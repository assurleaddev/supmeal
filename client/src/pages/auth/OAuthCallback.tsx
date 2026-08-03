import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { userApi } from '../../api';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error || !accessToken || !refreshToken) {
      toast.error('Authentification OAuth échouée');
      navigate('/login');
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    userApi.getMe()
      .then((res) => {
        const user = res.data.data!;
        setAuth(user, accessToken, refreshToken);
        toast.success(`Bienvenue, ${user.username} !`);
        navigate('/home');
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        toast.error('Erreur lors de la récupération du profil');
        navigate('/login');
      });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, bgcolor: 'background.default' }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" color="text.secondary">Connexion en cours...</Typography>
    </Box>
  );
}
