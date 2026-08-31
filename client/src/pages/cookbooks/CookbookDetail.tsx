import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Paper, Grid, Button, IconButton, Avatar, Chip,
  Tab, Tabs, TextField, Divider, FormControl, InputLabel, Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import { cookbookApi, recipeApi, RecipeFilters } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { useDebounce } from '../../hooks/useDebounce';
import { Message, CookbookRole } from '../../types';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import RecipeCard from '../../components/recipes/RecipeCard';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const ROLE_LABELS: Record<CookbookRole, string> = { CREATOR: 'Créateur', EDITOR: 'Éditeur', COMMENTER: 'Commentateur', READER: 'Lecteur' };

export default function CookbookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [tabIndex, setTabIndex] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CookbookRole>('READER');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { joinCookbook, leaveCookbook, sendMessage, onMessage } = useSocket();

  const { data: cookbook, isLoading } = useQuery({
    queryKey: ['cookbook', id],
    queryFn: () => cookbookApi.get(id!).then((r) => r.data.data!),
  });

  const filters: RecipeFilters = { cookbookId: id, q: debouncedSearch || undefined, limit: 20 };

  const { data: recipesData } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => recipeApi.list(filters).then((r) => r.data.data!),
    enabled: tabIndex === 0,
  });

  useEffect(() => {
    if (tabIndex !== 2 || !id) return;
    cookbookApi.getMessages(id).then((r) => {
      const msgs = (r.data.data || []).map((m: any) => ({ ...m, username: m.user.username, avatar: m.user.avatar, createdAt: m.createdAt }));
      setMessages(msgs);
    });
  }, [tabIndex, id]);

  useEffect(() => {
    if (!id) return;
    joinCookbook(id);
    const cleanup = onMessage((msg) => setMessages((prev) => [...prev, msg]));
    return () => { cleanup(); leaveCookbook(id); };
  }, [id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Les droits proviennent du serveur : la hiérarchie des rôles est une règle métier qui ne doit
  // pas être réimplémentée ici (§2.3.1).
  const permissions = cookbook?.permissions;
  const canEdit = permissions?.canEditRecipes ?? false;
  const canManageMembers = permissions?.canManageMembers ?? false;
  const canChat = permissions?.canChat ?? false;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !canChat) return;
    sendMessage(id!, msgInput.trim());
    setMsgInput('');
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      const res = await cookbookApi.invite(id!, { email: inviteEmail, role: inviteRole });
      setInviteLink(res.data.data!.token);
      toast.success('Invitation créée !');
      queryClient.invalidateQueries({ queryKey: ['cookbook', id] });
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDeleteCookbook = async () => {
    if (!confirm(`Supprimer le cookbook "${cookbook?.name}" ? Cette action est irréversible.`)) return;
    try {
      await cookbookApi.delete(id!);
      toast.success('Cookbook supprimé');
      queryClient.invalidateQueries({ queryKey: ['cookbooks'] });
      navigate('/cookbooks');
    } catch { toast.error('Erreur'); }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!confirm(`Retirer ${username} du cookbook ?`)) return;
    try {
      await cookbookApi.removeMember(id!, userId);
      toast.success('Membre retiré');
      queryClient.invalidateQueries({ queryKey: ['cookbook', id] });
    } catch { toast.error('Erreur'); }
  };

  const handleUpdateRole = async (userId: string, role: CookbookRole) => {
    try {
      await cookbookApi.updateMemberRole(id!, userId, role);
      toast.success('Rôle mis à jour');
      queryClient.invalidateQueries({ queryKey: ['cookbook', id] });
    } catch { toast.error('Erreur'); }
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><Typography color="text.secondary">Chargement...</Typography></Box>;
  if (!cookbook) return <Typography textAlign="center" py={8} color="text.secondary">Cookbook introuvable</Typography>;

  const coverUrl = cookbook.coverImage
    ? cookbook.coverImage.startsWith('http') ? cookbook.coverImage : `${API_URL}${cookbook.coverImage}`
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 160, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', position: 'relative', overflow: 'hidden' }}>
          {coverUrl && <img src={coverUrl} alt={cookbook.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end' }}>
            <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h5" fontWeight={700} color="white">{cookbook.name}</Typography>
                {cookbook.description && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>{cookbook.description}</Typography>}
              </Box>
              <Chip label={ROLE_LABELS[cookbook.myRole]} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            </Box>
          </Box>
        </Box>
        <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 3, color: 'text.secondary' }}>
            <Typography variant="body2">🍽 {cookbook._count?.recipes ?? 0} recettes</Typography>
            <Typography variant="body2">👥 {cookbook.members?.length ?? 0} membres</Typography>
            <Typography variant="body2">par {cookbook.createdBy.username}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canEdit && <Button component={Link} to={`/recipes/new?cookbookId=${id}`} variant="contained" size="small" startIcon={<AddIcon />}>Ajouter une recette</Button>}
            {canManageMembers && <Button variant="outlined" size="small" startIcon={<PersonAddIcon />} onClick={() => setInviteOpen(true)} color="inherit" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Inviter</Button>}
            {permissions?.canDeleteCookbook && <Button variant="contained" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleDeleteCookbook}>Supprimer</Button>}
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="🍽 Recettes" />
          <Tab label="👥 Membres" />
          <Tab label="💬 Chat" />
        </Tabs>
      </Box>

      {/* Recipes tab */}
      {tabIndex === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Input
            placeholder="Rechercher dans ce cookbook..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            leftIcon={<SearchIcon sx={{ fontSize: 18 }} />}
          />
          {recipesData?.items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <Typography fontSize={48} mb={2}>🍽️</Typography>
              <Typography variant="body1">Aucune recette dans ce cookbook</Typography>
              {canEdit && <Button component={Link} to={`/recipes/new?cookbookId=${id}`} variant="contained" sx={{ mt: 2 }}>Ajouter la première recette</Button>}
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recipesData?.items.map((recipe) => (
                <Grid item xs={12} sm={6} lg={4} xl={3} key={recipe.id}>
                  <RecipeCard recipe={recipe} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Members tab */}
      {tabIndex === 1 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={600}>Membres ({cookbook.members?.length})</Typography>
            {canManageMembers && <Button variant="outlined" size="small" startIcon={<PersonAddIcon />} onClick={() => setInviteOpen(true)}>Inviter</Button>}
          </Box>
          <Box>
            {cookbook.members?.map((member, i) => (
              <Box key={member.id}>
                {i > 0 && <Divider />}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
                  <Avatar src={member.user.avatar ?? undefined} sx={{ width: 36, height: 36, bgcolor: 'primary.50', color: 'primary.main', fontSize: 14, fontWeight: 700 }}>
                    {member.user.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{member.user.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{member.user.email}</Typography>
                  </Box>
                  {canManageMembers && member.userId !== user?.id ? (
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select native value={member.role} onChange={(e) => handleUpdateRole(member.userId, e.target.value as CookbookRole)}>
                        {(['EDITOR', 'COMMENTER', 'READER'] as CookbookRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Chip label={ROLE_LABELS[member.role]} size="small" color="primary" variant="outlined" />
                  )}
                  {canManageMembers && member.userId !== user?.id && (
                    <IconButton aria-label={`Retirer ${member.user.username} du cookbook`} size="small" onClick={() => handleRemoveMember(member.userId, member.user.username)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Chat tab */}
      {tabIndex === 2 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', height: '60vh' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={600}>💬 Messagerie du cookbook</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>Aucun message. Commencez la conversation !</Typography>
            )}
            {messages.map((msg) => {
              const isMe = msg.userId === user?.id;
              return (
                <Box key={msg.id} sx={{ display: 'flex', gap: 1, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.50', color: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                    {(msg.username || msg.user?.username || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 0.25, maxWidth: '70%' }}>
                    {!isMe && <Typography variant="caption" color="text.secondary">{msg.username || msg.user?.username}</Typography>}
                    <Box sx={{ px: 1.5, py: 1, borderRadius: 3, bgcolor: isMe ? 'primary.main' : 'grey.100', color: isMe ? 'white' : 'text.primary', borderBottomRightRadius: isMe ? 4 : 12, borderBottomLeftRadius: isMe ? 12 : 4 }}>
                      <Typography variant="body2">{msg.content}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled">{new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>
          <Box component="form" onSubmit={handleSendMessage} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
            <TextField
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              placeholder={canChat ? 'Écrire un message...' : 'Les lecteurs ne peuvent pas envoyer de messages'}
              disabled={!canChat}
              size="small"
              fullWidth
              variant="outlined"
            />
            <IconButton aria-label="Envoyer le message" type="submit" disabled={!msgInput.trim() || !canChat} color="primary">
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* Invite modal */}
      <Modal isOpen={inviteOpen} onClose={() => { setInviteOpen(false); setInviteLink(null); setInviteEmail(''); }} title="Inviter un membre">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {inviteLink ? (
            <>
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                <Typography variant="body2" color="success.dark">✅ Invitation créée ! Partagez ce token avec {inviteEmail} :</Typography>
              </Paper>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField value={inviteLink} size="small" fullWidth InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } }} />
                <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copié !'); }}>Copier</Button>
              </Box>
              <Button variant="contained" onClick={() => { setInviteLink(null); setInviteEmail(''); }}>Nouvelle invitation</Button>
            </>
          ) : (
            <>
              <Input label="Email du membre" type="email" value={inviteEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)} placeholder="membre@email.com" />
              <FormControl fullWidth size="small">
                <InputLabel>Rôle</InputLabel>
                <Select native label="Rôle" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CookbookRole)}>
                  {(['EDITOR', 'COMMENTER', 'READER'] as CookbookRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                <Button variant="text" color="inherit" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button variant="contained" onClick={handleInvite} disabled={!inviteEmail}>Créer l'invitation</Button>
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
}
