import { Users, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import InviteTeamModal from './InviteTeamModal';
import { useAuth } from '@/context/AuthContext';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

interface TournamentParticipantsTabProps {
  participants: any[];
  tournamentId: string;
  tournamentTier: number;
  isCreatorOrAdmin: boolean;
  tournamentGameId: string;
  isFull?: boolean;
  isPlanned?: boolean;
}

export default function TournamentParticipantsTab({
  participants,
  tournamentId,
  tournamentTier,
  isCreatorOrAdmin,
  tournamentGameId,
  isFull = false,
  isPlanned = false,
}: TournamentParticipantsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      await api.delete(`/tournament-participants/${participantId}`);
      toast.success('Команду успішно знято з турніру');
      // Оновлюємо списки
      queryClient.invalidateQueries({
        queryKey: ['tournamentParticipants', tournamentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['tournamentDetails', tournamentId],
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка видалення');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Список учасників</h3>

        {/* Кнопка запрошення (тільки до старту турніру) */}
        {isCreatorOrAdmin && !isFull && isPlanned && (
          <InviteTeamModal
            tournamentId={tournamentId}
            tournamentTier={tournamentTier}
            tournamentGameId={tournamentGameId}
          />
        )}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
          <Users size={18} className="text-esports-primary" /> Зареєстровані
          ростери
        </h3>
        {participants.length === 0 ? (
          <p className="text-slate-500 italic text-center py-10">
            Команд немає.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {participants.map((p: any) => {
              // Перевірка на капітана (беремо userId з бекенду)
              const isCaptain = p.team?.captain?.userId === user?.id;

              // Кнопка видалення доступна тільки до генерації сітки (isPlanned)
              // І тільки для (Адміна/Організатора АБО Капітана конкретної команди)
              const canRemove = isPlanned && (isCreatorOrAdmin || isCaptain);

              return (
                <Link
                  key={p.id}
                  to={`/team/${p.teamId}`}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-esports-primary hover:shadow-[0_0_15px_rgba(242,167,27,0.15)] transition-all cursor-pointer relative"
                >
                  <div className="flex-1 truncate pr-10">
                    <span className="font-bold text-white text-lg transition-colors group-hover:text-esports-light block truncate">
                      <span className="text-slate-500 font-normal group-hover:text-slate-400">
                        [{p.team?.tag}]
                      </span>{' '}
                      {p.team?.name}
                    </span>
                  </div>

                  {/* КНОПКА ЗНЯТТЯ З ТУРНІРУ */}
                  {canRemove && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
                      onClick={(e) => {
                        e.preventDefault(); // Блокуємо перехід по <Link>
                        e.stopPropagation();
                      }}
                    >
                      <ConfirmModal
                        title="Зняти команду з турніру?"
                        description="Ви впевнені, що хочете видалити цей ростер з учасників турніру? Дія безповоротна."
                        onConfirm={() => handleRemoveParticipant(p.id)}
                        confirmText="Так, видалити"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </ConfirmModal>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
