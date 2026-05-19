import { Trophy, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ConfirmModal";
import RegisterTeamModal from "./RegisterTeamModal";

interface TournamentHeaderProps {
  tournament: any;
  isAdminOrCreator: boolean;
  isFull: boolean;
  isAlreadyRegistered?: boolean;
  hasMatches: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

export default function TournamentHeader({
  tournament,
  isAdminOrCreator,
  isFull,
  isAlreadyRegistered = false,
  hasMatches,
  onCancel,
  onDelete,
}: TournamentHeaderProps) {
  // Дії доступні тільки якщо турнір перебуває на стадії планування
  const isPlanned = tournament.status === "planned";

  const canManage =
    tournament.status !== "finished" && tournament.status !== "cancelled";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div className="absolute top-0 left-0 w-96 h-full bg-gradient-to-r from-esports-primary/10 to-transparent pointer-events-none"></div>

      {/* ЛІВА ЧАСТИНА: Іконка та інформація */}
      <div className="flex items-center gap-5 relative z-10">
        <div className="w-16 h-16 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center font-black text-2xl text-yellow-500 shadow-inner">
          <Trophy size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {tournament.title}
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-4">
            <span>
              Дисципліна:{" "}
              <strong className="text-esports-accent uppercase">
                {tournament.game?.name}
              </strong>
            </span>
            <span>
              Регіон:{" "}
              <strong className="text-white">{tournament.region}</strong>
            </span>
            <span>
              Тір:{" "}
              <strong className="text-slate-300">Tier {tournament.tier}</strong>
            </span>
          </p>
        </div>
      </div>

      {/* ПРАВА ЧАСТИНА: Кнопки дій та статус */}
      <div className="flex flex-col items-end gap-3 relative z-10 w-full md:w-auto">
        {/* Блок з кнопками (Реєстрація + Адмін-панель дій) */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Кнопка реєстрації для публічних турнірів */}
          {tournament.isPublic &&
            isPlanned &&
            !isAlreadyRegistered &&
            !isFull && (
              <RegisterTeamModal tournament={tournament} isFull={isFull} />
            )}

          {/* Кнопки керування для творця або адміністратора */}
          {isAdminOrCreator && canManage && (
            <>
              {!hasMatches ? (
                /* ВАРІАНТ А: Матчів немає — повне фізичне видалення */
                <ConfirmModal
                  title="Видалити турнір назавжди?"
                  description="Цей турнір не містить згенерованих матчів. Повне видалення безпечно очистить його, всі подані заявки та ростери з бази даних."
                  onConfirm={onDelete}
                  confirmText="Так, видалити назавжди"
                >
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full sm:w-auto uppercase text-xs font-bold"
                  >
                    <Trash2 size={16} className="mr-2" /> Видалити турнір
                  </Button>
                </ConfirmModal>
              ) : (
                /* ВАРІАНТ Б: Матчі вже є — безпечний Soft Delete (Зміна статусу на скасований) */
                <ConfirmModal
                  title="Скасувати поточний турнір?"
                  description="У турнірі вже згенеровано матчі. Скасування збереже історію Elo, але анулює всі незіграні поєдинки й переведе подію в архів."
                  onConfirm={onCancel}
                  confirmText="Так, скасувати етап"
                >
                  <Button
                    variant="outline"
                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 w-full sm:w-auto uppercase text-xs font-bold"
                  >
                    <X size={16} className="mr-2" /> Скасувати турнір
                  </Button>
                </ConfirmModal>
              )}
            </>
          )}
        </div>

        {/* Статус турніру */}
        <Badge className="bg-esports-primary/20 text-esports-light border-esports-primary/30 uppercase font-black tracking-widest text-xs px-3 py-1 text-center justify-center w-full sm:w-auto">
          {tournament.status.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}
