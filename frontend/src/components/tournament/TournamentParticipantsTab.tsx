import { Users } from "lucide-react";

interface TournamentParticipantsTabProps {
  participants: any[];
}

export default function TournamentParticipantsTab({
  participants,
}: TournamentParticipantsTabProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
        <Users size={18} className="text-esports-primary" /> Зареєстровані
        ростери
      </h3>
      {participants.length === 0 ? (
        <p className="text-slate-500 italic text-center py-10">Команд немає.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {participants.map((p: any) => (
            <div
              key={p.id}
              className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-esports-primary transition-all"
            >
              <span className="font-bold text-white text-lg">
                <span className="text-slate-500 font-normal">
                  [{p.team?.tag}]
                </span>{" "}
                {p.team?.name}
              </span>
              <span className="text-xs font-black text-yellow-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                {p.team?.averageRating} ELO
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
