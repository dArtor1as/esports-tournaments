import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Shield, ArrowRight } from 'lucide-react';
import EditPlayerModal from './EditPlayerModal';
import CreateTeamModal from './CreateTeamModal';

interface PlayerProfileCardProps {
  player: any;
  isMyProfile: boolean;
  refreshData: () => void;
}

export default function PlayerProfileCard({
  player,
  isMyProfile,
  refreshData,
}: PlayerProfileCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/player/${player.id}`)}
      className="bg-slate-900 border-slate-800 text-white transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-esports-primary/20 hover:-translate-y-1 hover:border-esports-primary cursor-pointer group flex flex-col min-h-[220px]"
    >
      <CardHeader className="pb-3 flex-none">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl text-white group-hover:text-esports-light transition-colors">
              {player.nickname}
            </CardTitle>
            <CardDescription className="mt-2 inline-block bg-esports-accent/10 border border-esports-accent/20 text-esports-accent uppercase text-sm font-black tracking-widest px-2.5 py-0.5 rounded">
              {player.game.name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {player.inGameRole && (
              <Badge className="bg-esports-accent text-black font-black border-none px-3 py-1 text-xs">
                {player.inGameRole}
              </Badge>
            )}
            {isMyProfile && (
              <EditPlayerModal player={player} onSuccess={refreshData} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 flex-grow flex flex-col justify-end">
        <div className="flex items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800/50">
          <span className="text-slate-400 font-medium uppercase tracking-wider text-xs">
            Рейтинг Elo
          </span>
          <div className="flex items-center gap-2">
            <Trophy
              size={24}
              className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
            />
            <span className="font-black text-3xl text-yellow-400 tracking-tight drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
              {player.rating}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate w-full">
            <Shield size={16} className="text-slate-500 flex-shrink-0" />
            {player.team ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/team/${player.team.id}`);
                }}
                className="font-bold text-esports-light flex items-center gap-2 truncate cursor-pointer hover:text-esports-accent hover:bg-slate-800/80 px-2 py-1 -ml-2 rounded transition-colors w-full"
              >
                <span className="text-slate-500 font-normal group-hover/team:text-slate-400 transition-colors">
                  [{player.team.tag}]
                </span>
                <span className="truncate">{player.team.name}</span>
              </div>
            ) : (
              <div className="text-sm italic text-esports-muted px-2 py-1 w-full">
                Вільний агент
              </div>
            )}
          </div>
          {!player.team && isMyProfile && (
            <div onClick={(e) => e.stopPropagation()}>
              <CreateTeamModal player={player} onSuccess={refreshData} />
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <span className="text-esports-muted group-hover:text-esports-accent transition-colors text-sm font-semibold flex items-center gap-1">
            Повна статистика{' '}
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
