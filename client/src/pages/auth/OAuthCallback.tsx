import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

    // Store tokens temporarily to make the API call
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    userApi.getMe()
      .then((res) => {
        const user = res.data.data!;
        setAuth(user, accessToken, refreshToken);
        toast.success(`Bienvenue, ${user.username} !`);
        navigate('/');
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        toast.error('Erreur lors de la récupération du profil');
        navigate('/login');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Connexion en cours...</p>
      </div>
    </div>
  );
}
