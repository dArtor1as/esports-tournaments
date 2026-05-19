import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Mail, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import AcceptInviteModal from '@/components/tournament/AcceptInviteModal';

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');

  const [selectedInvite, setSelectedInvite] = useState<any>(null);

  const {
    data: invites,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['my-team-invites'],
    queryFn: async () => {
      const { data } = await api.get('/tournament-invitations/my-inbox');
      return data;
    },
  });

  //  АВТО-ВІДКРИТТЯ МОДАЛКИ ПРИ ПЕРЕХОДІ З EMAIL
  useEffect(() => {
    if (urlToken && invites && invites.length > 0) {
      const matchedInvite = invites.find((inv: any) => inv.token === urlToken);
      if (matchedInvite) {
        setSelectedInvite(matchedInvite);
      }
    }
  }, [urlToken, invites]);

  const handleDecline = async (token: string) => {
    if (!confirm('Ви впевнені, що хочете відхилити це запрошення?')) return;
    try {
      await api.patch(`/tournament-invitations/${token}/decline`);
      toast.success('Запрошення відхилено');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка');
    }
  };

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold">
        Перевірка пошти...
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800">
          <Mail className="text-esports-primary" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Вхідні запити</h1>
          <p className="text-slate-400 text-sm mt-1">
            Керуйте запрошеннями на турніри для ваших команд.
          </p>
        </div>
      </div>

      {!invites || invites.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 italic">
          У вас немає нових запрошень.
        </div>
      ) : (
        <div className="grid gap-4">
          {invites.map((invite: any) => (
            <div
              key={invite.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-black tracking-widest text-purple-400 border-purple-500/30 bg-purple-500/10"
                  >
                    Турнірне запрошення
                  </Badge>
                  <span className="text-[10px] text-slate-500">
                    Діє до: {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight">
                  {invite.tournament?.title}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Команда:{' '}
                  <strong className="text-esports-accent">
                    [{invite.team?.tag}] {invite.team?.name}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleDecline(invite.token)}
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold"
                >
                  <XCircle size={16} className="mr-1.5" /> Відхилити
                </Button>
                <Button
                  onClick={() => setSelectedInvite(invite)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider"
                >
                  Прийняти
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AcceptInviteModal
        invite={selectedInvite}
        isOpen={!!selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onSuccess={refetch}
      />
    </div>
  );
}
