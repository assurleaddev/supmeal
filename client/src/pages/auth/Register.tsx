import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
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
      const res = await authApi.register({
        email: data.email,
        username: data.username,
        password: data.password,
      });
      const { user, accessToken, refreshToken } = res.data.data!;
      setAuth(user, accessToken, refreshToken);
      toast.success('Compte créé avec succès !');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-gray-900">SUPMEAL</h1>
          <p className="text-gray-500 mt-1">Créez votre compte gratuitement</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Créer un compte</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                required: 'Nom d\'utilisateur requis',
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

            <Button type="submit" className="w-full" loading={loading} size="lg">
              Créer mon compte
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
