interface PlayerSummaryCardProps {
  player: any;
  age: number | null;
  kd: string;
  flagUrl: string | null;
}

export default function PlayerSummaryCard({
  player,
  age,
  kd,
  flagUrl,
}: PlayerSummaryCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-esports-primary/10 to-slate-900 z-0"></div>
      <div className="relative z-10 p-6 flex flex-col items-center text-center">
        <div className="w-full flex justify-between items-start mb-4">
          {flagUrl && (
            <img
              src={flagUrl}
              width="32"
              alt="Flag"
              className="rounded shadow-sm border border-slate-800"
            />
          )}
          {player.team && (
            <div className="px-2 py-1 bg-slate-950/50 rounded border border-slate-800 text-xs font-black text-esports-accent uppercase">
              {player.team.tag}
            </div>
          )}
        </div>
        <div className="w-40 h-40 rounded-full border-4 border-slate-800 bg-slate-950 flex items-center justify-center mb-4 shadow-xl">
          <span className="text-6xl font-black text-slate-800 uppercase">
            {player.nickname[0]}
          </span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-1">
          {player.nickname}
        </h1>
        <p className="text-sm text-esports-muted font-medium mb-6">
          {player.user?.username} {age ? `• ${age} років` : ''}
        </p>
        <div className="w-full bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
            <span className="text-xs text-slate-500 font-bold uppercase">
              Дисципліна
            </span>
            <span className="text-xs font-black bg-esports-accent/10 text-esports-accent border border-esports-accent/20 px-2 py-0.5 rounded uppercase tracking-wider">
              {player.game?.name}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-800/60 py-2">
            <span className="text-xs text-slate-500 font-bold uppercase">
              Рейтинг Elo
            </span>
            <span className="text-xl font-black text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]">
              {player.rating}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-xs text-slate-500 font-bold uppercase">
              K/D Ratio
            </span>
            <span
              className={`text-sm font-black ${Number(kd) >= 1.0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {kd}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
