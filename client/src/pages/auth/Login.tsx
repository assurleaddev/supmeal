import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Box, Paper, Typography, Divider, Stack, Button as MuiButton } from '@mui/material';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface LoginForm {
  email: string;
  password: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? '';

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

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary">ou continuer avec</Typography>
          </Divider>

          {/* OAuth buttons */}
          <Stack direction="row" spacing={1.5}>
            <MuiButton
              component="a"
              href={`${API_URL}/api/auth/google`}
              variant="outlined"
              fullWidth
              sx={{ borderColor: 'divider', color: 'text.primary', gap: 1 }}
              startIcon={
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            >
              Google
            </MuiButton>
            <MuiButton
              component="a"
              href={`${API_URL}/api/auth/github`}
              variant="outlined"
              fullWidth
              sx={{ borderColor: 'divider', color: 'text.primary', gap: 1 }}
              startIcon={
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              }
            >
              GitHub
            </MuiButton>
            <MuiButton
              component="a"
              href={`${API_URL}/api/auth/microsoft`}
              variant="outlined"
              fullWidth
              sx={{ borderColor: 'divider', color: 'text.primary', gap: 1 }}
              startIcon={
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#f25022" d="M1 1h10v10H1z"/>
                  <path fill="#00a4ef" d="M13 1h10v10H13z"/>
                  <path fill="#7fba00" d="M1 13h10v10H1z"/>
                  <path fill="#ffb900" d="M13 13h10v10H13z"/>
                </svg>
              }
            >
              Microsoft
            </MuiButton>
          </Stack>

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
