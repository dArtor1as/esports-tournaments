import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
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

interface EditProfileModalProps {
  user: { id: string; username: string; countryCode?: string };
  onSuccess: () => void;
}

export default function EditProfileModal({
  user,
  onSuccess,
}: EditProfileModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user: currentUser, updateUser } = useAuth();

  const [username, setUsername] = useState(user.username);
  const [countryCode, setCountryCode] = useState(user.countryCode || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formattedCountryCode = countryCode.trim().toUpperCase();

      await api.patch(`/users/${user.id}`, {
        username,
        countryCode: formattedCountryCode,
      });

      // Оновлюємо ім'я у шапці глобально!
      if (currentUser?.id === user.id) {
        updateUser({ username, countryCode: formattedCountryCode });
      }

      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка оновлення профілю');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          Редагувати профіль
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-esports-accent">
            Редагувати дані
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Нікнейм (User ID)</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Код країни (UA, PL, US)</Label>
            <Input
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              placeholder="UA"
              className="bg-slate-800 border-slate-700 uppercase text-white"
              maxLength={2}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            disabled={loading}
            type="submit"
            className="w-full bg-esports-primary hover:bg-esports-primary/90 text-white"
          >
            {loading ? 'Збереження...' : 'Зберегти зміни'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
