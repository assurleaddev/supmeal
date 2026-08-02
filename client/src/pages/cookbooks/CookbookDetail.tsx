import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cookbookApi, recipeApi, RecipeFilters } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { useDebounce } from '../../hooks/useDebounce';
import { Message, CookbookRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import RecipeCard from '../../components/recipes/RecipeCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ROLE_LABELS: Record<CookbookRole, string> = {
  CREATOR: 'Créateur', EDITOR: 'Éditeur', COMMENTER: 'Commentateur', READER: 'Lecteur',
};
const ROLE_COLORS: Record<CookbookRole, string> = {
  CREATOR: 'bg-primary-100 text-primary-800',
  EDITOR: 'bg-blue-100 text-blue-800',
  COMMENTER: 'bg-yellow-100 text-yellow-800',
  READER: 'bg-gray-100 text-gray-700',
};

type Tab = 'recipes' | 'members' | 'chat';

export default function CookbookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('recipes');
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

  const filters: RecipeFilters = {
    cookbookId: id,
    q: debouncedSearch || undefined,
    limit: 20,
  };

  const { data: recipesData } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => recipeApi.list(filters).then((r) => r.data.data!),
    enabled: tab === 'recipes',
  });

  // Load message history when chat tab is active
  useEffect(() => {
    if (tab !== 'chat' || !id) return;
    cookbookApi.getMessages(id).then((r) => {
      const msgs = (r.data.data || []).map((m: any) => ({
        ...m,
        username: m.user.username,
        avatar: m.user.avatar,
        createdAt: m.createdAt,
      }));
      setMessages(msgs);
    });
  }, [tab, id]);

  // Socket.io setup
  useEffect(() => {
    if (!id) return;
    joinCookbook(id);
    const cleanup = onMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      cleanup();
      leaveCookbook(id);
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myRole = cookbook?.myRole;
  const canEdit = myRole === 'CREATOR' || myRole === 'EDITOR';
  const canManageMembers = myRole === 'CREATOR';
  const canChat = myRole !== undefined && myRole !== 'READER';

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
      const token = res.data.data!.token;
      setInviteLink(token);
      toast.success('Invitation créée !');
      queryClient.invalidateQueries({ queryKey: ['cookbook', id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!cookbook) return <div className="text-center py-16 text-gray-500">Cookbook introuvable</div>;

  const coverUrl = cookbook.coverImage
    ? cookbook.coverImage.startsWith('http') ? cookbook.coverImage : `${API_URL}${cookbook.coverImage}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-card">
        <div className="h-40 bg-gradient-to-r from-primary-500 to-primary-700 relative overflow-hidden">
          {coverUrl && <img src={coverUrl} alt={cookbook.name} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{cookbook.name}</h1>
              {cookbook.description && <p className="text-white/80 text-sm mt-0.5">{cookbook.description}</p>}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[cookbook.myRole]}`}>
              {ROLE_LABELS[cookbook.myRole]}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>🍽 {cookbook._count?.recipes ?? 0} recettes</span>
            <span>👥 {cookbook.members?.length ?? 0} membres</span>
            <span>par {cookbook.createdBy.username}</span>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Link to={`/recipes/new?cookbookId=${id}`}>
                <Button size="sm">+ Ajouter une recette</Button>
              </Link>
            )}
            {canManageMembers && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                📩 Inviter
              </Button>
            )}
            {myRole === 'CREATOR' && (
              <Button size="sm" variant="danger" onClick={handleDeleteCookbook}>
                Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['recipes', '🍽 Recettes'], ['members', '👥 Membres'], ['chat', '💬 Chat']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recipes tab */}
      {tab === 'recipes' && (
        <div className="space-y-4">
          <Input
            placeholder="Rechercher dans ce cookbook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          {recipesData?.items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🍽️</div>
              <p>Aucune recette dans ce cookbook</p>
              {canEdit && <Link to={`/recipes/new?cookbookId=${id}`}><Button className="mt-4">Ajouter la première recette</Button></Link>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recipesData?.items.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Membres ({cookbook.members?.length})</h2>
            {canManageMembers && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>+ Inviter</Button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {cookbook.members?.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  {member.user.avatar ? (
                    <img src={member.user.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <span className="text-primary-700 font-semibold text-sm">{member.user.username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{member.user.username}</p>
                  <p className="text-xs text-gray-400">{member.user.email}</p>
                </div>
                {canManageMembers && member.userId !== user?.id ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.userId, e.target.value as CookbookRole)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {(['EDITOR', 'COMMENTER', 'READER'] as CookbookRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                )}
                {canManageMembers && member.userId !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.userId, member.user.username)}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card flex flex-col" style={{ height: '60vh' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">💬 Messagerie du cookbook</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">Aucun message. Commencez la conversation !</div>
            )}
            {messages.map((msg) => {
              const isMe = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 self-end">
                    <span className="text-primary-700 text-xs font-semibold">
                      {(msg.username || msg.user?.username || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {!isMe && <span className="text-xs text-gray-500 px-1">{msg.username || msg.user?.username}</span>}
                    <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-400 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              placeholder={canChat ? 'Écrire un message...' : 'Les lecteurs ne peuvent pas envoyer de messages'}
              disabled={!canChat}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <Button type="submit" disabled={!msgInput.trim() || !canChat} size="sm">
              Envoyer
            </Button>
          </form>
        </div>
      )}

      {/* Invite modal */}
      <Modal isOpen={inviteOpen} onClose={() => { setInviteOpen(false); setInviteLink(null); setInviteEmail(''); }} title="Inviter un membre">
        <div className="space-y-4">
          {inviteLink ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                ✅ Invitation créée ! Partagez ce token avec {inviteEmail} :
              </p>
              <div className="flex gap-2">
                <input readOnly value={inviteLink} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50" />
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copié !'); }}>
                  Copier
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setInviteLink(null); setInviteEmail(''); }}>
                Nouvelle invitation
              </Button>
            </div>
          ) : (
            <>
              <Input label="Email du membre" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="membre@email.com" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CookbookRole)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {(['EDITOR', 'COMMENTER', 'READER'] as CookbookRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button onClick={handleInvite} disabled={!inviteEmail}>Créer l'invitation</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
