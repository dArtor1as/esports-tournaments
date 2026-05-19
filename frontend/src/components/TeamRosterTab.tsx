import { Users, Shield, UserPlus } from 'lucide-react';
import TeamRosterCard from './TeamRosterCard';
import { getFlagUrl } from '@/lib/helpers';

interface TeamRosterTabProps {
  activePlayers: any[]; // Ті, у кого teamRole === 'PLAYER' або 'CAPTAIN'
  coach: any; // teamRole === 'COACH'
  substitutes: any[]; // teamRole === 'SUBSTITUTE' (потрібно передати з TeamProfile!)
  team: any;
  currentUser: any;
  isCaptain: boolean;
  onKick: (id: string) => void;
  onLeave: (id: string) => void;
}

export default function TeamRosterTab({
  activePlayers,
  coach,
  substitutes = [], // Додаємо запасних
  team,
  currentUser,
  isCaptain,
  onKick,
  onLeave,
}: TeamRosterTabProps) {
  return (
    <div className="space-y-6">
      {/* Секція основи */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Users size={18} className="text-esports-primary" /> Основний склад
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
          {activePlayers.length === 0 && (
            <p className="text-slate-500 text-sm italic py-4 col-span-full">
              У складі команди немає активних гравців.
            </p>
          )}
          {activePlayers.map((player) => (
            <TeamRosterCard
              key={player.id}
              player={player}
              team={team}
              currentUser={currentUser}
              isCaptain={isCaptain}
              onKick={onKick}
              onLeave={onLeave}
            />
          ))}
        </div>

        <div className="border-t border-slate-800/80 pt-6">
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 max-w-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Shield size={20} />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">
                  Головний тренер
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getFlagUrl(coach?.user?.countryCode) && (
                    <img
                      src={getFlagUrl(coach?.user?.countryCode)!}
                      width="16"
                      alt="Flag"
                    />
                  )}
                  <span
                    className={`font-bold ${coach ? 'text-white text-base' : 'text-slate-600 text-sm italic'}`}
                  >
                    {coach ? coach.nickname : 'Місце вільне'}
                  </span>
                </div>
              </div>
            </div>
            {coach && (
              <div className="text-right">
                <span className="text-[9px] text-slate-500 uppercase font-black block">
                  Rating
                </span>
                <span className="text-sm font-black text-yellow-500 mt-0.5 block">
                  {coach.rating} ELO
                </span>
              </div>
            )}
          </div>
        </div>
        {/* НОВА СЕКЦІЯ: Запасні гравці */}
        {substitutes.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserPlus size={18} className="text-slate-400" /> Запасні гравці
              (Substitutes)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
              {substitutes.map((sub) => (
                <TeamRosterCard
                  key={sub.id}
                  player={sub}
                  team={team}
                  currentUser={currentUser}
                  isCaptain={isCaptain}
                  onKick={onKick}
                  onLeave={onLeave}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
