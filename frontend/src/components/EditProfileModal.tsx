import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import DeleteConfirmationZone from './DeleteConfirmationZone';

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
  const { user: currentUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Стейт для редагування
  const [username, setUsername] = useState(user.username);
  const [countryCode, setCountryCode] = useState(user.countryCode || '');
  const [error, setError] = useState('');

  // Стейт для режиму видалення
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Скидання стану при закритті
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
      const formattedCountryCode = countryCode.trim().toUpperCase();

      await api.patch(`/users/${user.id}`, {
        username,
        countryCode: formattedCountryCode,
      });

      if (currentUser?.id === user.id) {
        updateUser({ username, countryCode: formattedCountryCode });
      }

      toast.success('Профіль успішно оновлено');
      onSuccess();
      setIsOpen(false);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Помилка під час оновлення профілю',
      );
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  // ЗАПРОСИТИ КОД
  const handleRequestCode = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await api.post(`/users/${user.id}/delete-code`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка відправки коду');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };
  // ВІДПРАВИТИ КОД І ВИДАЛИТИ
  const handleDeleteAccount = async (code?: string) => {
    setIsDeleting(true);
    setError('');
    try {
      const url = code ? `/users/${user.id}?code=${code}` : `/users/${user.id}`;
      await api.delete(url);
      toast.success('Акаунт успішно анонімізовано');

      if (currentUser?.id === user.id) {
        logout();
        navigate('/');
      } else {
        onSuccess();
        setIsOpen(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка під час видалення');
      setIsDeleting(false); // Залишаємось тут, якщо помилка
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
        >
          <Settings size={16} className="mr-2" />
          Налаштування
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        {/* РЕЖИМ ВИДАЛЕННЯ */}
        {isDeleteMode ? (
          <DeleteConfirmationZone
            entityType="USER"
            entityName={user.username}
            requireCode={!isAdmin} // Адмін видаляє без коду
            isProcessing={isDeleting}
            error={error}
            onCancel={() => setIsDeleteMode(false)}
            onRequestCode={handleRequestCode}
            onConfirm={handleDeleteAccount}
          />
        ) : (
          /* РЕЖИМ РЕДАГУВАННЯ (СТАНДАРТНИЙ) */
          <>
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
              Видалити акаунт
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
