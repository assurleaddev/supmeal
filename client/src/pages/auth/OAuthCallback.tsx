import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { userApi } from '../../api';
import toast from 'react-hot-toast';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, setTokens, logout } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error || !accessToken || !refreshToken) {
      toast.error('Authentification OAuth échouée');
      navigate('/login');
      return;
    }

    // Les jetons sont confiés au store, qui les persiste : les écrire ici en plus créerait une
    // seconde source de vérité, à l'origine de la boucle de rechargement.
    setTokens(accessToken, refreshToken);

    userApi.getMe()
      .then((res) => {
        const user = res.data.data!;
        setAuth(user, accessToken, refreshToken);
        toast.success(`Bienvenue, ${user.username} !`);
        navigate('/home');
      })
      .catch(() => {
        logout();
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
