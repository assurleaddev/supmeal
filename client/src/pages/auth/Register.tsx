import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface RegisterForm {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const res = await authApi.register({ email: data.email, username: data.username, password: data.password });
      const { user, accessToken, refreshToken } = res.data.data!;
      setAuth(user, accessToken, refreshToken);
      toast.success('Compte créé avec succès !');
      navigate('/home');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, bgcolor: 'primary.main', borderRadius: 3, mb: 2 }}>
            <Typography color="white" fontSize={24} fontWeight={700}>S</Typography>
          </Box>
          <Typography variant="h4" fontWeight={700}>SUPMEAL</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>Créez votre compte gratuitement</Typography>
        </Box>

        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={3}>Créer un compte</Typography>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <Input
                label="Email"
                type="email"
                placeholder="votre@email.com"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email requis',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email invalide' },
                })}
              />
              <Input
                label="Nom d'utilisateur"
                type="text"
                placeholder="chef_dupont"
                error={errors.username?.message}
                hint="3 à 30 caractères, lettres, chiffres et _"
                {...register('username', {
                  required: "Nom d'utilisateur requis",
                  minLength: { value: 3, message: 'Minimum 3 caractères' },
                  maxLength: { value: 30, message: 'Maximum 30 caractères' },
                  pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Lettres, chiffres et _ uniquement' },
                })}
              />
              <Input
                label="Mot de passe"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                hint="Minimum 8 caractères"
                {...register('password', {
                  required: 'Mot de passe requis',
                  minLength: { value: 8, message: 'Minimum 8 caractères' },
                })}
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Confirmation requise',
                  validate: (v) => v === password || 'Les mots de passe ne correspondent pas',
                })}
              />
              <Button type="submit" fullWidth loading={loading} size="lg">Créer mon compte</Button>
            </Stack>
          </form>

          <Typography variant="body2" color="text.secondary" textAlign="center" mt={3}>
            Déjà un compte ?{' '}
            <Typography component={Link} to="/login" variant="body2" color="primary" fontWeight={600} sx={{ textDecoration: 'none' }}>
              Se connecter
            </Typography>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
