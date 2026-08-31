import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Tabs, Tab, Button, Avatar, Chip, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { userApi, oauthApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PROVIDER_META, useOAuthProviders } from '../../components/auth/OAuthProviderButtons';
import { OAuthProvider } from '../../types';

const DIET_OPTIONS = ['Végétarien', 'Vegan', 'Sans gluten', 'Sans lactose', 'Halal', 'Casher', 'Paléo', 'Keto'];
const CUISINE_OPTIONS = ['Française', 'Italienne', 'Japonaise', 'Mexicaine', 'Indienne', 'Thaïlandaise', 'Méditerranéenne', 'Américaine'];
const ALLERGY_OPTIONS = ['Gluten', 'Arachides', 'Noix', 'Lait', 'Oeufs', 'Soja', 'Poisson', 'Crustacés', 'Céleri', 'Moutarde'];

export default function Settings() {
  const [tab, setTab] = useState(0);
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { providers: oauthProviders } = useOAuthProviders();
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

  const { register: regProfile, handleSubmit: handleProfile, formState: { errors: profileErrors } } = useForm({
    defaultValues: { username: user?.username || '' },
  });

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
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  const onChangePassword = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await userApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Mot de passe modifié !');
      resetPwd();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
    finally { setLoading(false); }
  };

  const onSavePreferences = async () => {
    setLoading(true);
    try {
      await userApi.updatePreferences({ diet, allergies, cuisineTypes: cuisines, defaultPortions });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Préférences sauvegardées !');
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  // Le rattachement passe par le serveur, qui émet un `state` signé identifiant le compte courant.
  // Ouvrir directement /api/auth/<provider> relançait une simple connexion et pouvait basculer la
  // session sur un autre compte si l'adresse e-mail du fournisseur différait.
  const handleLinkOAuth = async (provider: OAuthProvider) => {
    try {
      const { data } = await oauthApi.link(provider);
      window.location.href = data.data!.url;
    } catch {
      toast.error('Impossible de démarrer la liaison');
    }
  };

  const handleUnlinkOAuth = async (provider: string) => {
    if (!confirm(`Dissocier le compte ${provider} ?`)) return;
    try {
      await userApi.unlinkOAuth(provider);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Compte dissocié');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" fontWeight={700}>Paramètres</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Profil" />
          <Tab label="Mot de passe" />
          <Tab label="Préférences" />
          <Tab label="Connexions" />
        </Tabs>
      </Box>

      {/* Profile tab */}
      {tab === 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h6" fontWeight={600}>Informations du profil</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={profile?.avatar ?? undefined} sx={{ width: 64, height: 64, bgcolor: 'primary.50', color: 'primary.main', fontSize: 24, fontWeight: 700 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography fontWeight={600}>{profile?.username}</Typography>
              <Typography variant="body2" color="text.secondary">{profile?.email}</Typography>
              <Typography variant="caption" color="text.disabled">
                Membre depuis {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR') : '...'}
              </Typography>
            </Box>
          </Box>
          <Box component="form" onSubmit={handleProfile(onSaveProfile)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Input label="Nom d'utilisateur" error={profileErrors.username?.message} {...regProfile('username', { required: true, minLength: 3 })} />
            <Input label="Email" value={profile?.email || ''} disabled hint="L'email ne peut pas être modifié" />
            <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer le profil'}</Button>
          </Box>
        </Paper>
      )}

      {/* Password tab */}
      {tab === 1 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" fontWeight={600}>Changer le mot de passe</Typography>
          {profile?.oauthAccounts && profile.oauthAccounts.length > 0 && !profile.preferences && (
            <Alert severity="warning">Votre compte utilise OAuth. Définissez un mot de passe pour vous connecter sans OAuth.</Alert>
          )}
          <Box component="form" onSubmit={handlePwd(onChangePassword)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Input label="Mot de passe actuel" type="password" error={pwdErrors.currentPassword?.message} {...regPwd('currentPassword', { required: 'Requis' })} />
            <Input label="Nouveau mot de passe" type="password" error={pwdErrors.newPassword?.message} {...regPwd('newPassword', { required: 'Requis', minLength: { value: 8, message: 'Min 8 caractères' } })} />
            <Input label="Confirmer le nouveau mot de passe" type="password" error={pwdErrors.confirmPassword?.message} {...regPwd('confirmPassword', { required: 'Requis' })} />
            <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={loading}>{loading ? 'Modification...' : 'Changer le mot de passe'}</Button>
          </Box>
        </Paper>
      )}

      {/* Preferences tab */}
      {tab === 2 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h6" fontWeight={600}>Préférences culinaires</Typography>

          <Box>
            <Typography variant="body2" fontWeight={600} mb={1}>Régime alimentaire</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {DIET_OPTIONS.map((d) => (
                <Chip key={d} label={d} onClick={() => toggleItem(diet, setDiet, d)} color={diet.includes(d) ? 'primary' : 'default'} variant={diet.includes(d) ? 'filled' : 'outlined'} sx={{ cursor: 'pointer' }} />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={600} mb={1}>Allergies</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {ALLERGY_OPTIONS.map((a) => (
                <Chip key={a} label={a} onClick={() => toggleItem(allergies, setAllergies, a)} color={allergies.includes(a) ? 'error' : 'default'} variant={allergies.includes(a) ? 'filled' : 'outlined'} sx={{ cursor: 'pointer' }} />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={600} mb={1}>Cuisines préférées</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {CUISINE_OPTIONS.map((c) => (
                <Chip key={c} label={c} onClick={() => toggleItem(cuisines, setCuisines, c)} color={cuisines.includes(c) ? 'warning' : 'default'} variant={cuisines.includes(c) ? 'filled' : 'outlined'} sx={{ cursor: 'pointer' }} />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={600} mb={1}>Portions par défaut</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button variant="outlined" size="small" onClick={() => setDefaultPortions((v) => Math.max(1, v - 1))} sx={{ minWidth: 32, p: 0.5, borderRadius: '50%' }}><RemoveIcon fontSize="small" /></Button>
              <Typography variant="h6" fontWeight={700} sx={{ minWidth: 32, textAlign: 'center' }}>{defaultPortions}</Typography>
              <Button variant="outlined" size="small" onClick={() => setDefaultPortions((v) => Math.min(20, v + 1))} sx={{ minWidth: 32, p: 0.5, borderRadius: '50%' }}><AddIcon fontSize="small" /></Button>
              <Typography variant="body2" color="text.secondary">personnes</Typography>
            </Box>
          </Box>

          <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={onSavePreferences} disabled={loading}>{loading ? 'Sauvegarde...' : 'Sauvegarder les préférences'}</Button>
        </Paper>
      )}

      {/* OAuth tab */}
      {tab === 3 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" fontWeight={600}>Comptes liés</Typography>
          <Typography variant="body2" color="text.secondary">Gérez vos connexions OAuth2</Typography>

          {oauthProviders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucun fournisseur OAuth2 n'est configuré sur ce déploiement.
            </Typography>
          )}

          {oauthProviders.map((provider) => {
            const linked = profile?.oauthAccounts?.find((a) => a.provider === provider);
            const { label, Icon } = PROVIDER_META[provider];

            return (
              <Box key={provider} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Icon />
                  <Typography fontWeight={600}>{label}</Typography>
                  {linked && <Badge variant="success" size="sm">Lié</Badge>}
                </Box>
                {linked ? (
                  <Button variant="contained" color="error" size="small" onClick={() => handleUnlinkOAuth(provider)}>Dissocier</Button>
                ) : (
                  <Button variant="outlined" size="small" color="inherit" onClick={() => handleLinkOAuth(provider)} sx={{ borderColor: 'divider', color: 'text.primary' }}>Lier</Button>
                )}
              </Box>
            );
          })}
        </Paper>
      )}
    </Box>
  );
}
