import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import DeleteConfirmationZone from './DeleteConfirmationZone';

const ROLES: Record<string, string[]> = {
  cs2: ['SNIPER', 'RIFLER', 'ENTRY', 'SUPPORT', 'IGL'],
  dota2: ['POS_1', 'POS_2', 'POS_3', 'POS_4', 'POS_5'],
};

interface EditPlayerModalProps {
  player: {
    id: string;
    nickname: string;
    inGameRole: string;
    game: { slug: string };
  };
  onSuccess: () => void;
}

export default function EditPlayerModal({
  player,
  onSuccess,
}: EditPlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [nickname, setNickname] = useState(player.nickname);
  const [inGameRole, setInGameRole] = useState(player.inGameRole || '');

  // Стейт для режиму видалення
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const gameRoles = ROLES[player.game.slug] || [];

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setIsDeleteMode(false);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/players/${player.id}`, {
        nickname,
        inGameRole: inGameRole || undefined,
      });
      toast.success('Ігровий профіль оновлено');
      onSuccess();
      setIsOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка оновлення');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/players/${player.id}`);
      toast.success('Ігровий профіль успішно анонімізовано');
      onSuccess();
      setIsOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка під час видалення');
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          className="h-8 w-8 p-0 text-slate-400 hover:text-esports-accent hover:bg-esports-accent/10 rounded-full transition-colors"
        >
          <Settings size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        {/* Режим видалення */}
        {isDeleteMode ? (
          <DeleteConfirmationZone
            entityType="PLAYER"
            entityName={player.nickname}
            requireCode={false} // Ігрові профілі видаляємо без коду з пошти
            isProcessing={isDeleting}
            error={error}
            onCancel={() => setIsDeleteMode(false)}
            onConfirm={handleDeleteProfile}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-esports-accent">
                Налаштування профілю
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Ігровий нікнейм</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                  maxLength={30}
                />
              </div>

              {gameRoles.length > 0 && (
                <div className="space-y-2">
                  <Label>Ігрова роль</Label>
                  <Select value={inGameRole} onValueChange={setInGameRole}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Оберіть роль" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {gameRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <Button
                disabled={loading}
                type="submit"
                className="w-full bg-esports-primary hover:bg-esports-primary/90 text-white font-bold"
              >
                {loading ? 'Збереження...' : 'Зберегти зміни'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500 font-bold tracking-widest">
                  Небезпечна зона
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteMode(true)}
              className="w-full border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400"
            >
              <Trash2 size={16} className="mr-2" />
              Видалити ігровий профіль
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
