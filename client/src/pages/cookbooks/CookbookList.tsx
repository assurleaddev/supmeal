import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { cookbookApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CookbookFormData {
  name: string;
  description?: string;
}

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
    } finally {
      setCreating(false);
    }
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
    } finally {
      setJoining(false);
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    CREATOR: 'Créateur',
    EDITOR: 'Éditeur',
    COMMENTER: 'Commentateur',
    READER: 'Lecteur',
  };

  const ROLE_COLORS: Record<string, string> = {
    CREATOR: 'bg-primary-100 text-primary-800',
    EDITOR: 'bg-blue-100 text-blue-800',
    COMMENTER: 'bg-yellow-100 text-yellow-800',
    READER: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Cookbooks</h1>
          <p className="text-gray-500 text-sm mt-0.5">Recueils de recettes partagés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            🔗 Rejoindre
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            + Créer un cookbook
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : cookbooks?.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun cookbook</h3>
          <p className="text-gray-500 mb-6">Créez un cookbook partagé ou rejoignez-en un</p>
          <Button onClick={() => setCreateOpen(true)}>Créer mon premier cookbook</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cookbooks?.map((cb) => {
            const coverUrl = cb.coverImage
              ? cb.coverImage.startsWith('http') ? cb.coverImage : `${API_URL}${cb.coverImage}`
              : null;

            return (
              <Link key={cb.id} to={`/cookbooks/${cb.id}`} className="group">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5">
                  <div className="h-36 bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden relative">
                    {coverUrl ? (
                      <img src={coverUrl} alt={cb.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-5xl">📚</div>
                    )}
                    {/* Role badge */}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[cb.myRole]}`}>
                      {ROLE_LABELS[cb.myRole]}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">{cb.name}</h3>
                    {cb.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cb.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span>🍽 {cb._count?.recipes ?? 0} recettes</span>
                      <span>👥 {cb._count?.members ?? 0} membres</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Créer un cookbook">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input label="Nom" required placeholder="Mes recettes familiales..."
            error={errors.name?.message}
            {...register('name', { required: 'Nom requis' })} />
          <Textarea label="Description" placeholder="Description optionnelle..." {...register('description')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" loading={creating}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Join Modal */}
      <Modal isOpen={joinOpen} onClose={() => setJoinOpen(false)} title="Rejoindre un cookbook">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Entrez le token d'invitation qui vous a été envoyé.</p>
          <Input
            label="Token d'invitation"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            placeholder="Token ou URL d'invitation..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>Annuler</Button>
            <Button onClick={handleJoin} loading={joining} disabled={!joinToken.trim()}>Rejoindre</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
