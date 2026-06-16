import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TournamentBracketProps {
  matches: any[];
  bracketType: string;
  isForecast?: boolean;
}

const MatchNode = ({
  match,
  isForecast,
}: {
  match: any;
  isForecast?: boolean;
  onMatchClick?: (match: any) => void;
}) => {
  const navigate = useNavigate();

  const isTeamAWin = match.scoreA > match.scoreB;
  const isTeamBWin = match.scoreB > match.scoreA;
  const isPlayed =
    match.scoreA > 0 || match.scoreB > 0 || match.matchStatus === 'COMPLETED';
  const handleNodeClick = () => {
    if (isForecast) return; // Якщо це прогноз - нічого не робимо
    navigate(`/match/${match.id}`);
  };
  return (
    <div
      onClick={handleNodeClick}
      className={`w-52 sm:w-60 bg-slate-900/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg flex flex-col text-xs font-mono mb-4 flex-shrink-0 transition-all duration-300 ${!isForecast ? 'hover:border-esports-primary hover:shadow-[0_0_15px_rgba(242,167,27,0.3)] cursor-pointer group' : 'cursor-default'}`}
    >
      {/* TEAM A */}
      <div
        className={`flex justify-between items-center p-2.5 border-b border-slate-700/50 transition-colors ${isPlayed && isTeamAWin ? 'bg-emerald-500/10' : 'group-hover:bg-slate-800'}`}
      >
        <span
          className={`truncate px-1 ${isPlayed && !isTeamAWin ? 'text-slate-400 font-medium' : isPlayed && isTeamAWin ? 'text-emerald-400 font-black' : 'text-white font-medium'}`}
        >
          {match.teamA ? `[${match.teamA.tag}] ${match.teamA.name}` : '(TBD)'}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded font-black text-sm ${isPlayed && isTeamAWin ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] bg-emerald-500/20' : 'text-slate-400'}`}
        >
          {match.scoreA ?? '-'}
        </span>
      </div>

      {/* TEAM B */}
      <div
        className={`flex justify-between items-center p-2.5 transition-colors ${isPlayed && isTeamBWin ? 'bg-emerald-500/10' : 'group-hover:bg-slate-800'}`}
      >
        <span
          className={`truncate px-1 ${isPlayed && !isTeamBWin ? 'text-slate-400 font-medium' : isPlayed && isTeamBWin ? 'text-emerald-400 font-black' : 'text-white font-medium'}`}
        >
          {match.teamB ? `[${match.teamB.tag}] ${match.teamB.name}` : '(TBD)'}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded font-black text-sm ${isPlayed && isTeamBWin ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] bg-emerald-500/20' : 'text-slate-400'}`}
        >
          {match.scoreB ?? '-'}
        </span>
      </div>
    </div>
  );
};
const BracketTree = ({
  matches,
  title,
  colorClass = 'text-white',
  isForecast,
}: {
  matches: any[];
  title?: string;
  colorClass?: string;
  isForecast?: boolean;
  onMatchClick?: (match: any) => void;
}) => {
  const rounds = matches.reduce((acc: any, match: any) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const roundNumbers = Object.keys(rounds).sort(
    (a, b) => Number(a) - Number(b),
  );

  return (
    <div className="mb-8 animate-in fade-in duration-300">
      {title && (
        <h4
          className={`font-black uppercase text-xs tracking-widest mb-4 border-l-4 pl-3 border-slate-700 ${colorClass}`}
        >
          {title}
        </h4>
      )}
      <div className="flex gap-8 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {roundNumbers.map((round) => (
          <div
            key={round}
            className="flex flex-col justify-around min-h-[250px]"
          >
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center mb-3 bg-slate-950/40 py-1 rounded border border-slate-800/40 px-2">
              Раунд {round}
            </div>
            <div className="flex flex-col gap-2 justify-center flex-1">
              {rounds[round].map((match: any) => (
                <MatchNode
                  key={match.id}
                  match={match}
                  isForecast={isForecast}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function TournamentBracket({
  matches,
  bracketType,
  isForecast,
}: TournamentBracketProps) {
  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-950 border border-slate-800/60 border-dashed rounded-xl text-slate-500 italic">
        Матчі ще не згенеровано організатором.
      </div>
    );
  }

  if (bracketType === 'ROUND_ROBIN') {
    const groupMatches = matches.filter((m) => m.stage === 'GROUP');
    const groups = groupMatches.reduce((acc: any, match: any) => {
      const gName = match.groupName || 'Group Stage';
      if (!acc[gName]) acc[gName] = [];
      acc[gName].push(match);
      return acc;
    }, {});

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(groups)
          .sort()
          .map((groupName) => (
            <div
              key={groupName}
              className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 shadow-inner"
            >
              <h4 className="font-black text-esports-accent text-sm uppercase tracking-wider mb-4 border-b border-slate-800 pb-2.5 flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> {groupName}
              </h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {groups[groupName].map((match: any) => (
                  <div
                    key={match.id}
                    className="flex justify-between items-center text-xs font-mono bg-slate-900 border border-slate-800/40 p-3 rounded-xl hover:border-slate-700/60 transition-colors"
                  >
                    <span className="w-2/5 truncate text-right text-slate-300 font-medium">
                      {match.teamA?.name || 'TBD'}
                    </span>
                    <span className="w-1/5 text-center font-black text-emerald-400 bg-slate-950 py-1 rounded-lg border border-slate-800/50 min-w-[65px] drop-shadow-[0_0_6px_rgba(52,211,153,0.2)]">
                      {match.scoreA} - {match.scoreB}
                    </span>
                    <span className="w-2/5 truncate text-left text-slate-300 font-medium">
                      {match.teamB?.name || 'TBD'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    );
  }

  if (bracketType === 'DOUBLE_ELIMINATION') {
    const upperMatches = matches.filter((m) => m.bracket === 'UPPER');
    const lowerMatches = matches.filter((m) => m.bracket === 'LOWER');
    const grandFinal = matches.filter((m) => m.bracket === 'GRAND_FINAL');

    return (
      <div className="space-y-8">
        <BracketTree
          matches={upperMatches}
          title="Upper Bracket (Верхня сітка)"
          colorClass="text-blue-400"
          isForecast={isForecast}
        />
        {lowerMatches.length > 0 && (
          <BracketTree
            matches={lowerMatches}
            title="Lower Bracket (Нижня сітка)"
            colorClass="text-orange-400"
            isForecast={isForecast}
          />
        )}
        {grandFinal.length > 0 && (
          <BracketTree
            matches={grandFinal}
            title="Grand Final (Гранд-Фінал)"
            colorClass="text-yellow-400"
            isForecast={isForecast}
          />
        )}
      </div>
    );
  }

  const playoffMatches = matches.filter(
    (m) =>
      m.stage === 'PLAYOFF' || m.bracket === 'UPPER' || m.bracket === 'NONE',
  );
  return (
    <BracketTree
      matches={playoffMatches}
      title="Playoff Bracket"
      colorClass="text-esports-primary"
      isForecast={isForecast}
    />
  );
}
