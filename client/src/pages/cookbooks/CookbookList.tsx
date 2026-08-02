import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Box, Typography, Grid, Paper, Chip, Button, CardActionArea,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import { cookbookApi } from '../../api';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface CookbookFormData { name: string; description?: string; }

const ROLE_LABELS: Record<string, string> = { CREATOR: 'Créateur', EDITOR: 'Éditeur', COMMENTER: 'Commentateur', READER: 'Lecteur' };
const ROLE_COLORS: Record<string, 'primary' | 'info' | 'warning' | 'default'> = { CREATOR: 'primary', EDITOR: 'info', COMMENTER: 'warning', READER: 'default' };

export default function CookbookList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cookbooks, isLoading } = useQuery({
    queryKey: ['cookbooks'],
    queryFn: () => cookbookApi.list().then((r) => r.data.data!),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CookbookFormData>();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async (data: CookbookFormData) => {
    setCreating(true);
    try {
      const res = await cookbookApi.create(data);
      toast.success('Cookbook créé !');
      queryClient.invalidateQueries({ queryKey: ['cookbooks'] });
      reset();
      setCreateOpen(false);
      navigate(`/cookbooks/${res.data.data!.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setCreating(false); }
  };

  const handleJoin = async () => {
    if (!joinToken.trim()) return;
    setJoining(true);
    try {
      const res = await cookbookApi.join(joinToken.trim());
      toast.success(`Vous avez rejoint "${res.data.data!.cookbookName}" !`);
      queryClient.invalidateQueries({ queryKey: ['cookbooks'] });
      setJoinOpen(false);
      setJoinToken('');
      navigate(`/cookbooks/${res.data.data!.cookbookId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lien invalide ou expiré');
    } finally { setJoining(false); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Mes Cookbooks</Typography>
          <Typography variant="body2" color="text.secondary">Recueils de recettes partagés</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => setJoinOpen(true)} color="inherit" sx={{ borderColor: 'divider', color: 'text.primary' }}>
            Rejoindre
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Créer un cookbook
          </Button>
        </Box>
      </Box>

      {/* Grid */}
      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} lg={4} key={i}>
              <Paper elevation={0} sx={{ height: 200, borderRadius: 3, bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider' }} />
            </Grid>
          ))}
        </Grid>
      ) : cookbooks?.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography fontSize={56} mb={2}>📚</Typography>
          <Typography variant="h6" fontWeight={600} mb={1}>Aucun cookbook</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>Créez un cookbook partagé ou rejoignez-en un</Typography>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>Créer mon premier cookbook</Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {cookbooks?.map((cb) => {
            const coverUrl = cb.coverImage
              ? cb.coverImage.startsWith('http') ? cb.coverImage : `${API_URL}${cb.coverImage}`
              : null;

            return (
              <Grid item xs={12} sm={6} lg={4} key={cb.id}>
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }}>
                  <CardActionArea component={Link} to={`/cookbooks/${cb.id}`}>
                    <Box sx={{ height: 140, bgcolor: 'primary.50', position: 'relative', overflow: 'hidden' }}>
                      {coverUrl ? (
                        <img src={coverUrl} alt={cb.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📚</Box>
                      )}
                      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                        <Chip label={ROLE_LABELS[cb.myRole]} size="small" color={ROLE_COLORS[cb.myRole]} />
                      </Box>
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body1" fontWeight={600}>{cb.name}</Typography>
                      {cb.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}>
                          {cb.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, color: 'text.secondary' }}>
                        <Typography variant="caption">🍽 {cb._count?.recipes ?? 0} recettes</Typography>
                        <Typography variant="caption">👥 {cb._count?.members ?? 0} membres</Typography>
                      </Box>
                    </Box>
                  </CardActionArea>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Créer un cookbook">
        <Box component="form" onSubmit={handleSubmit(handleCreate)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Input label="Nom *" placeholder="Mes recettes familiales..." error={errors.name?.message} {...register('name', { required: 'Nom requis' })} />
          <Textarea label="Description" placeholder="Description optionnelle..." {...register('description')} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, pt: 1 }}>
            <Button variant="text" color="inherit" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" variant="contained" disabled={creating}>{creating ? 'Création...' : 'Créer'}</Button>
          </Box>
        </Box>
      </Modal>

      {/* Join Modal */}
      <Modal isOpen={joinOpen} onClose={() => setJoinOpen(false)} title="Rejoindre un cookbook">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">Entrez le token d'invitation qui vous a été envoyé.</Typography>
          <Input label="Token d'invitation" value={joinToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinToken(e.target.value)} placeholder="Token ou URL d'invitation..." />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button variant="text" color="inherit" onClick={() => setJoinOpen(false)}>Annuler</Button>
            <Button variant="contained" onClick={handleJoin} disabled={joining || !joinToken.trim()}>{joining ? 'Rejoindre...' : 'Rejoindre'}</Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}
