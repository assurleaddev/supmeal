import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { userApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

const DIET_OPTIONS = ['Végétarien', 'Vegan', 'Sans gluten', 'Sans lactose', 'Halal', 'Casher', 'Paléo', 'Keto'];
const CUISINE_OPTIONS = ['Française', 'Italienne', 'Japonaise', 'Mexicaine', 'Indienne', 'Thaïlandaise', 'Méditerranéenne', 'Américaine'];
const ALLERGY_OPTIONS = ['Gluten', 'Arachides', 'Noix', 'Lait', 'Oeufs', 'Soja', 'Poisson', 'Crustacés', 'Céleri', 'Moutarde'];

type Tab = 'profile' | 'password' | 'preferences' | 'oauth';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile');
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => userApi.getMe().then((r) => r.data.data!),
  });

  const [diet, setDiet] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [defaultPortions, setDefaultPortions] = useState(4);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (profile?.preferences && !prefsLoaded) {
      setDiet(profile.preferences.diet || []);
      setAllergies(profile.preferences.allergies || []);
      setCuisines(profile.preferences.cuisineTypes || []);
      setDefaultPortions(profile.preferences.defaultPortions || 4);
      setPrefsLoaded(true);
    }
  }, [profile]);

  // Profile form
  const { register: regProfile, handleSubmit: handleProfile, formState: { errors: profileErrors } } = useForm({
    defaultValues: { username: user?.username || '' },
  });

  // Password form
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string;
  }>();

  const onSaveProfile = async (data: any) => {
    setLoading(true);
    try {
      const res = await userApi.updateProfile({ username: data.username });
      updateUser(res.data.data!);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profil mis à jour !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  const onChangePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await userApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Mot de passe modifié !');
      resetPwd();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  const onSavePreferences = async () => {
    setLoading(true);
    try {
      await userApi.updatePreferences({ diet, allergies, cuisineTypes: cuisines, defaultPortions });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Préférences sauvegardées !');
    } catch { toast.error('Erreur'); } finally { setLoading(false); }
  };

  const handleUnlinkOAuth = async (provider: string) => {
    if (!confirm(`Dissocier le compte ${provider} ?`)) return;
    try {
      await userApi.unlinkOAuth(provider);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Compte dissocié');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const tabItems: [Tab, string][] = [['profile', 'Profil'], ['password', 'Mot de passe'], ['preferences', 'Préférences'], ['oauth', 'Connexions']];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabItems.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Informations du profil</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              {profile?.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-primary-700 text-2xl font-bold">{user?.username?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile?.username}</p>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Membre depuis {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR') : '...'}
              </p>
            </div>
          </div>
          <form onSubmit={handleProfile(onSaveProfile)} className="space-y-4">
            <Input label="Nom d'utilisateur" {...regProfile('username', { required: true, minLength: 3 })}
              error={profileErrors.username?.message} />
            <Input label="Email" value={profile?.email || ''} disabled hint="L'email ne peut pas être modifié" />
            <Button type="submit" loading={loading}>Enregistrer le profil</Button>
          </form>
        </div>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Changer le mot de passe</h2>
          {profile?.oauthAccounts && profile.oauthAccounts.length > 0 && !profile.preferences && (
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              ⚠️ Votre compte utilise OAuth. Définissez un mot de passe pour vous connecter sans OAuth.
            </div>
          )}
          <form onSubmit={handlePwd(onChangePassword)} className="space-y-4">
            <Input label="Mot de passe actuel" type="password" {...regPwd('currentPassword', { required: 'Requis' })}
              error={pwdErrors.currentPassword?.message} />
            <Input label="Nouveau mot de passe" type="password" {...regPwd('newPassword', { required: 'Requis', minLength: { value: 8, message: 'Min 8 caractères' } })}
              error={pwdErrors.newPassword?.message} />
            <Input label="Confirmer le nouveau mot de passe" type="password"
              {...regPwd('confirmPassword', { required: 'Requis' })} error={pwdErrors.confirmPassword?.message} />
            <Button type="submit" loading={loading}>Changer le mot de passe</Button>
          </form>
        </div>
      )}

      {/* Preferences tab */}
      {tab === 'preferences' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Préférences culinaires</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Régime alimentaire</label>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((d) => (
                <button key={d} type="button" onClick={() => toggleItem(diet, setDiet, d)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    diet.includes(d) ? 'bg-primary-100 border-primary-300 text-primary-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
            <div className="flex flex-wrap gap-2">
              {ALLERGY_OPTIONS.map((a) => (
                <button key={a} type="button" onClick={() => toggleItem(allergies, setAllergies, a)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    allergies.includes(a) ? 'bg-red-100 border-red-300 text-red-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cuisines préférées</label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => toggleItem(cuisines, setCuisines, c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    cuisines.includes(c) ? 'bg-accent-100 border-accent-300 text-accent-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Portions par défaut</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setDefaultPortions((v) => Math.max(1, v - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold">−</button>
              <span className="text-lg font-semibold w-8 text-center">{defaultPortions}</span>
              <button type="button" onClick={() => setDefaultPortions((v) => Math.min(20, v + 1))}
                className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold">+</button>
              <span className="text-sm text-gray-500 ml-1">personnes</span>
            </div>
          </div>

          <Button onClick={onSavePreferences} loading={loading}>Sauvegarder les préférences</Button>
        </div>
      )}

      {/* OAuth tab */}
      {tab === 'oauth' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Comptes liés</h2>
          <p className="text-sm text-gray-500">Gérez vos connexions OAuth2</p>

          {(['google', 'github', 'microsoft'] as const).map((provider) => {
            const linked = profile?.oauthAccounts?.find((a) => a.provider === provider);
            const icons: Record<string, string> = { google: '🔵 Google', github: '⚫ GitHub', microsoft: '🟦 Microsoft' };
            const API_URL_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

            return (
              <div key={provider} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">{icons[provider]}</span>
                  {linked && <Badge variant="success" size="sm">Lié</Badge>}
                </div>
                {linked ? (
                  <Button variant="danger" size="sm" onClick={() => handleUnlinkOAuth(provider)}>
                    Dissocier
                  </Button>
                ) : (
                  <a href={`${API_URL_BASE}/api/auth/${provider}`}>
                    <Button variant="outline" size="sm">Lier</Button>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
