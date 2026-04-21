import type { TournamentMatch } from "../../types/tournament";
import {
  Match,
  SingleEliminationBracket,
  SVGViewer,
} from "@g-loot/react-tournament-brackets";

type BracketNode = {
  id: string;
  name: string;
  nextMatchId: string | null;
  nextLooserMatchId: string | null;
  tournamentRoundText: string;
  startTime: string;
  state: "DONE" | "SCHEDULED";
  participants: Array<{
    id: string;
    name: string;
    resultText?: string;
    isWinner: boolean;
  }>;
};

function roundLabel(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return "Гранд-фінал";
    case 2:
      return "Півфінал";
    case 4:
      return "1/4 фіналу";
    case 8:
      return "1/8 фіналу";
    case 16:
      return "1/16 фіналу";
    default:
      return "Раунд";
  }
}

function toBracketMatches(matches: TournamentMatch[]): BracketNode[] {
  const roundCounts = matches
    .filter((match) => match.stage === "PLAYOFF")
    .reduce((acc, match) => {
      acc.set(match.round, (acc.get(match.round) ?? 0) + 1);
      return acc;
    }, new Map<number, number>());

  return matches
    .filter((match) => match.stage === "PLAYOFF")
    .map((match) => {
      const teamAName = match.teamA?.tag ?? match.teamA?.name ?? "TBD";
      const teamBName = match.teamB?.tag ?? match.teamB?.name ?? "TBD";
      const isDone = match.scoreA > 0 || match.scoreB > 0;

      return {
        id: match.id,
        name: `Раунд ${match.round}`,
        nextMatchId: match.nextMatchWinner?.id ?? null,
        nextLooserMatchId: null,
        tournamentRoundText: roundLabel(roundCounts.get(match.round) ?? 0),
        startTime: new Date().toISOString(),
        state: isDone ? "DONE" : "SCHEDULED",
        participants: [
          {
            id: match.teamA?.id ?? `${match.id}-a`,
            name: teamAName,
            resultText: `${match.scoreA}`,
            isWinner: match.scoreA > match.scoreB,
          },
          {
            id: match.teamB?.id ?? `${match.id}-b`,
            name: teamBName,
            resultText: `${match.scoreB}`,
            isWinner: match.scoreB > match.scoreA,
          },
        ],
      };
    });
}

type Props = {
  matches: TournamentMatch[];
};

export function PlayoffBracket({ matches }: Props) {
  const playoffMatches = toBracketMatches(matches);

  if (playoffMatches.length === 0) {
    return (
      <div className="card">
        <h3>Playoff bracket</h3>
        <p>Матчі плейоф ще не згенеровано.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Playoff bracket</h3>
      <div className="bracket-wrapper">
        <SingleEliminationBracket
          matches={playoffMatches}
          matchComponent={Match}
          svgWrapper={({
            children,
            ...props
          }: {
            children: React.ReactNode;
            [key: string]: any;
          }) => (
            <SVGViewer width={1050} height={550} {...props}>
              {children}
            </SVGViewer>
          )}
        />
      </div>
    </div>
  );
}
