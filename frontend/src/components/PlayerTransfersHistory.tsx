import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ArrowRightLeft, UserPlus, UserMinus, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export default function PlayerTransfersHistory({
  playerId,
}: {
  playerId: string;
}) {
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['playerTransfers', playerId],
    queryFn: async () => {
      const { data } = await api.get(`/players/${playerId}/transfers`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl min-h-[346px] flex items-center justify-center text-slate-500 animate-pulse font-bold">
        Завантаження історії...
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl min-h-[346px] flex flex-col items-center justify-center text-slate-500 italic">
        <ArrowRightLeft size={48} className="mb-4 opacity-20" />
        Історія трансферів порожня.
      </div>
    );
  }

  const getTransferStyle = (type: string) => {
    switch (type) {
      case 'JOIN':
        return {
          icon: <UserPlus size={14} />,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          text: 'Приєднався',
        };
      case 'LEAVE':
        return {
          icon: <UserMinus size={14} />,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          text: 'Покинув команду',
        };
      case 'KICK':
        return {
          icon: <ShieldAlert size={14} />,
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          text: 'Виключено',
        };
      default:
        return {
          icon: <ArrowRightLeft size={14} />,
          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          text: type,
        };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-xl min-h-[346px]">
      <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-wider">
        <ArrowRightLeft className="text-esports-accent" size={20} /> Історія
        переходів
      </h3>

      {/* Лівосторонній Таймлайн */}
      <div className="relative border-l-2 border-slate-800 ml-4 space-y-8 pb-4">
        {transfers.map((transfer: any) => {
          const style = getTransferStyle(transfer.type);
          const date = new Date(transfer.createdAt).toLocaleDateString(
            'uk-UA',
            {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            },
          );

          return (
            <div key={transfer.id} className="relative pl-8">
              {/* Крапка (Іконка) на лінії */}
              <div
                className={`absolute -left-[17px] top-0 flex items-center justify-center w-8 h-8 rounded-full border-4 border-slate-900 shadow-md ${style.color}`}
              >
                {style.icon}
              </div>

              {/* Картка події */}
              <div className="bg-slate-950/50 border border-slate-800/60 p-4 rounded-xl hover:border-slate-700 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={`uppercase text-[10px] font-black ${style.color}`}
                  >
                    {style.text}
                  </Badge>
                  <time className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {date}
                  </time>
                </div>

                <div className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Команда:</span>
                  <Link
                    to={`/team/${transfer.teamId}`}
                    className="flex items-center gap-1.5 hover:text-esports-light transition-colors group"
                  >
                    <span className="text-esports-accent font-black text-[10px] uppercase tracking-wider bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded group-hover:bg-slate-800 transition-colors">
                      [{transfer.team.tag}]
                    </span>
                    <span className="group-hover:underline truncate max-w-[150px] sm:max-w-none">
                      {transfer.team.name}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
