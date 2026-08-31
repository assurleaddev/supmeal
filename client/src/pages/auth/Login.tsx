import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import OAuthProviderButtons from '../../components/auth/OAuthProviderButtons';

interface LoginForm {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      const { user, accessToken, refreshToken } = res.data.data!;
      setAuth(user, accessToken, refreshToken);
      toast.success(`Bienvenue, ${user.username} !`);
      navigate('/home');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, bgcolor: 'primary.main', borderRadius: 3, mb: 2 }}>
            <Typography color="white" fontSize={24} fontWeight={700}>S</Typography>
          </Box>
          <Typography variant="h4" fontWeight={700}>SUPMEAL</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Gérez vos recettes et planifiez vos repas</Typography>
        </Box>

        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3}>Se connecter</Typography>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <Input
                label="Email"
                type="email"
                placeholder="votre@email.com"
                error={errors.email?.message}
                {...register('email', { required: 'Email requis' })}
              />
              <Input
                label="Mot de passe"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password', { required: 'Mot de passe requis' })}
              />
              <Button type="submit" fullWidth loading={loading} size="lg">Se connecter</Button>
            </Stack>
          </form>

          <OAuthProviderButtons />

          <Typography variant="body2" color="text.secondary" textAlign="center" mt={3}>
            Pas encore de compte ?{' '}
            <Typography component={Link} to="/register" variant="body2" color="primary" fontWeight={600} sx={{ textDecoration: 'none' }}>
              S'inscrire
            </Typography>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
