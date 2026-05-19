import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import InviteTeamModal from "./InviteTeamModal";

interface TournamentParticipantsTabProps {
  participants: any[];
  tournamentId: string;
  tournamentTier: number;
  isCreatorOrAdmin: boolean;
  tournamentGameId: string;
  isFull?: boolean;
}

export default function TournamentParticipantsTab({
  participants,
  tournamentId,
  tournamentTier,
  isCreatorOrAdmin,
  tournamentGameId,
  isFull = false,
}: TournamentParticipantsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Список учасників</h3>

        {/* Кнопка запрошення для організаторів */}
        {isCreatorOrAdmin && !isFull && (
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
            {participants.map((p: any) => (
              <Link
                key={p.id}
                to={`/team/${p.teamId}`}
                className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-esports-primary hover:shadow-[0_0_15px_rgba(242,167,27,0.15)] transition-all cursor-pointer"
              >
                <span className="font-bold text-white text-lg transition-colors group-hover:text-esports-light">
                  <span className="text-slate-500 font-normal group-hover:text-slate-400">
                    [{p.team?.tag}]
                  </span>{" "}
                  {p.team?.name}
                </span>
                <span className="text-xs font-black text-yellow-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                  {p.team?.averageRating} ELO
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
