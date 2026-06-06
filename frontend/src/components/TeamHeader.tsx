import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Trophy, Crown } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import TransferLeadershipModal from './TransferLeadershipModal';
import InvitePlayerModal from './InvitePlayerModal';
import { getFlagUrl } from '@/lib/helpers';

interface TeamHeaderProps {
  team: any;
  teamFlag: string | null;
  isCaptain: boolean;
  isAdmin?: boolean;
  onDisband: () => void;
  onTransferSuccess: () => void;
}

export default function TeamHeader({
  team,
  teamFlag,
  isCaptain,
  isAdmin = false,
  onDisband,
  onTransferSuccess,
}: TeamHeaderProps) {
  const activeCount =
    team?.players?.filter(
      (p: any) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN',
    ).length || 0;

  const isRosterComplete = activeCount >= 5;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-96 h-full bg-gradient-to-r from-esports-primary/10 to-transparent pointer-events-none"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center font-black text-2xl text-esports-accent shadow-inner">
            {team.tag}
          </div>
          <div>
            <div className="flex items-center gap-3">
              {teamFlag && (
                <img
                  src={teamFlag}
                  width="36"
                  alt="Flag"
                  className="rounded shadow-sm border border-slate-950 align-middle"
                />
              )}
              <h1 className="text-3xl font-black text-white">{team.name}</h1>
              <Badge className="bg-esports-primary/20 text-esports-light border-esports-primary/30 uppercase tracking-widest text-[10px]">
                {team.game?.name}
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-4">
              <span>
                Регіон: <strong className="text-white">{team.region}</strong>
              </span>
              <span>
                Тір:{' '}
                <strong className="text-esports-accent">
                  Tier {team.tier}
                </strong>
              </span>
              <span>
                Статус:{' '}
                <strong
                  className={
                    isRosterComplete ? 'text-green-400' : 'text-yellow-400'
                  }
                >
                  {isRosterComplete ? 'Повний склад' : 'Неповний склад'}
                </strong>
              </span>
            </p>
          </div>
        </div>

        {(isCaptain || isAdmin) && (
          <div className="flex flex-col gap-2 relative z-10">
            <TransferLeadershipModal
              teamId={team.id}
              players={team.players}
              currentCaptainId={team.captainId}
              onSuccess={onTransferSuccess}
            />
            <ConfirmModal
              title="Розформувати команду?"
              description="Ця дія безповоротно видалить команду та звільнить усіх гравців."
              onConfirm={onDisband}
            >
              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 text-xs font-bold w-full"
              >
                <Trash2 size={14} className="mr-1.5" /> Розформувати
              </Button>
            </ConfirmModal>
          </div>
        )}
      </div>

      {isCaptain && (
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
          <div>
            <h4 className="text-sm font-black text-esports-accent uppercase tracking-wider">
              Панель управління капітана
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Введіть ігровий нікнейм, щоб надіслати офіційне запрошення.
            </p>
          </div>
          <InvitePlayerModal teamId={team.id} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-xs text-slate-500 uppercase font-black tracking-wider block">
              Командний Elo
            </span>
            <span className="text-3xl font-black text-yellow-400 mt-1 block">
              {team.averageRating}
            </span>
          </div>
          <Trophy size={28} className="text-yellow-400" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-xl md:col-span-2">
          <div>
            <span className="text-xs text-slate-500 uppercase font-black tracking-wider block">
              Капітан команди
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              {getFlagUrl(team.captain?.user?.countryCode) && (
                <img
                  src={getFlagUrl(team.captain?.user?.countryCode)!}
                  width="20"
                  alt="Flag"
                />
              )}
              <span className="text-lg font-bold text-white">
                {team.captain ? (
                  team.captain.nickname
                ) : (
                  <span className="text-slate-600 italic">Не призначено</span>
                )}
              </span>
            </div>
          </div>
          <Crown size={28} className="text-esports-accent" />
        </div>
      </div>
    </div>
  );
}
