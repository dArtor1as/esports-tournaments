import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Crown } from 'lucide-react';

interface TransferLeadershipModalProps {
  teamId: string;
  players: any[];
  currentCaptainId: string;
  onSuccess: () => void;
}

export default function TransferLeadershipModal({
  teamId,
  players,
  currentCaptainId,
  onSuccess,
}: TransferLeadershipModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newCaptainId, setNewCaptainId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/teams/${teamId}/transfer-leadership`, {
        newCaptainPlayerId: newCaptainId,
      });
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка передачі лідерства.');
    } finally {
      setLoading(false);
    }
  };

  // Фільтруємо капітана, щоб він не міг передати лідерство самому собі
  const candidatePlayers = players.filter((p) => p.id !== currentCaptainId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 text-xs font-bold h-8"
        >
          <Crown size={14} className="mr-1.5" /> Передати лідерство
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-yellow-500 flex items-center gap-2">
            <Crown size={20} /> Передача прав капітана
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Оберіть нового капітана зі складу команди. Ви втратите права на
            управління ростером.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleTransfer} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Новий капітан</Label>
            <Select
              value={newCaptainId}
              onValueChange={setNewCaptainId}
              required
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white font-medium">
                <SelectValue placeholder="Оберіть гравця..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {candidatePlayers.length === 0 && (
                  <div className="p-2 text-sm text-slate-500 italic">
                    У команді немає інших гравців.
                  </div>
                )}
                {candidatePlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <Button
            disabled={loading || !newCaptainId || candidatePlayers.length === 0}
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
          >
            {loading ? 'Передача...' : 'Передати права'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
