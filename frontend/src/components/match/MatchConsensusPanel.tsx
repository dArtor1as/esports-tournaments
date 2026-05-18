import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Swords, ShieldAlert, CheckCircle2, Gavel, Clock } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface MatchConsensusPanelProps {
  match: any;
  currentUser: any;
  loading: boolean;
  onAction: (action: string, payload?: any) => void;
}

export default function MatchConsensusPanel({
  match,
  currentUser,
  loading,
  onAction,
}: MatchConsensusPanelProps) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  // Бізнес-логіка доступу
  const isCaptainA =
    match.teamA?.players?.find((p: any) => p.id === match.teamA?.captainId)
      ?.userId === currentUser?.id;
  const isCaptainB =
    match.teamB?.players?.find((p: any) => p.id === match.teamB?.captainId)
      ?.userId === currentUser?.id;
  const isAnyCaptain = isCaptainA || isCaptainB;
  const canForceResolve =
    match.tournament?.creatorId === currentUser?.id ||
    currentUser?.role === "ADMIN";

  const winScoreLimit = Math.floor((match.bestOf || 3) / 2) + 1;
  const status = match.matchStatus || "PENDING";
  const isDisputed = status === "DISPUTED";
  const isPending = status === "PENDING";

  const isReported = status === "REPORTED";
  const isReportedByMe = isReported && match.reportedById === currentUser?.id;
  const isReportedByOpponent =
    isReported && match.reportedById && match.reportedById !== currentUser?.id;

  const proposedScoreA =
    match.details?.proposedScoreA ??
    match.reportedScoreA ??
    match.details?.scoreA ??
    match.scoreA;
  const proposedScoreB =
    match.details?.proposedScoreB ??
    match.reportedScoreB ??
    match.details?.scoreB ??
    match.scoreB;

  if (status === "COMPLETED" || match.isProcessed) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Сценарій 1: Репорт */}
      {isAnyCaptain && (isPending || isDisputed) && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Swords className="text-esports-primary" size={18} /> Надіслати
              результат
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 space-y-2">
                <Label className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Перемог {match.teamA?.tag}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={winScoreLimit}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-lg font-black text-center"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Перемог {match.teamB?.tag}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={winScoreLimit}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-lg font-black text-center"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-auto">
            <Button
              onClick={() => onAction("report", { scoreA, scoreB })}
              disabled={loading || !scoreA || !scoreB}
              className="w-full bg-esports-accent text-black font-bold uppercase text-xs"
            >
              Зарепортити рахунок
            </Button>
            <ConfirmModal
              title="Здати матч?"
              description="Технічна поразка."
              onConfirm={() =>
                onAction("forfeit", {
                  forfeitingTeamId: isCaptainA
                    ? match.teamA.id
                    : match.teamB.id,
                })
              }
            >
              <Button
                variant="ghost"
                className="w-full text-[10px] text-slate-500 hover:text-red-400 uppercase tracking-widest"
              >
                Здатися (Forfeit)
              </Button>
            </ConfirmModal>
          </div>
        </div>
      )}

      {/* Сценарій 2: Очікування */}
      {isAnyCaptain && isReportedByMe && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <Clock className="text-blue-500 mb-3" size={32} />
          <h3 className="text-lg font-black text-white mb-2">
            Звіт відправлено
          </h3>
          <p className="text-sm text-slate-400">
            Очікуємо підтвердження від опонента.
          </p>
        </div>
      )}

      {/* Сценарій 3: Відповідь */}
      {isAnyCaptain && isReportedByOpponent && (
        <div className="bg-slate-900 border border-blue-500/30 p-6 rounded-xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2 border-b border-slate-800 pb-3">
              <ShieldAlert className="text-blue-400" size={18} /> Дія від
              опонента
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Опонент стверджує, що рахунок:{" "}
              <strong className="text-esports-accent">
                {proposedScoreA} : {proposedScoreB}
              </strong>
            </p>
          </div>
          <div className="space-y-3 mt-auto">
            <Button
              onClick={() => onAction("confirm")}
              disabled={loading}
              className="w-full bg-emerald-600/20 text-emerald-400 font-bold uppercase text-xs"
            >
              <CheckCircle2 size={16} className="mr-2" /> Підтвердити
            </Button>
            <div className="pt-2">
              {!showDispute ? (
                <Button
                  onClick={() => setShowDispute(true)}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 text-xs uppercase font-bold"
                >
                  Оскаржити
                </Button>
              ) : (
                <div className="space-y-2 animate-in fade-in">
                  <Input
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Причина..."
                    className="bg-slate-950 border-red-500/50 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowDispute(false)}
                      variant="ghost"
                      className="text-xs flex-1"
                    >
                      Скасувати
                    </Button>
                    <Button
                      onClick={() =>
                        onAction("dispute", { reason: disputeReason })
                      }
                      disabled={loading || !disputeReason}
                      className="bg-red-600 text-white font-bold text-xs uppercase flex-1"
                    >
                      Відправити
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Панель Адміна */}
      {canForceResolve && (
        <div
          className={`bg-slate-900 border p-6 rounded-xl shadow-xl flex flex-col justify-between ${isDisputed ? "border-red-500/50" : "border-purple-500/30"}`}
        >
          <div>
            <h3
              className={`text-lg font-black flex items-center gap-2 mb-2 border-b border-slate-800 pb-3 ${isDisputed ? "text-red-400" : "text-purple-400"}`}
            >
              <Gavel size={18} />{" "}
              {isDisputed ? "Вирішення Диспуту" : "Адмін-Панель"}
            </h3>
            <div className="flex gap-4 mb-4">
              <Input
                type="number"
                min={0}
                max={winScoreLimit}
                placeholder={`A`}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                className="bg-slate-950 border-slate-700 text-center font-black"
              />
              <Input
                type="number"
                min={0}
                max={winScoreLimit}
                placeholder={`B`}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                className="bg-slate-950 border-slate-700 text-center font-black"
              />
            </div>
          </div>
          <ConfirmModal
            title="Примусове рішення"
            description="Закрити матч в обхід капітанів."
            onConfirm={() => onAction("force-resolve", { scoreA, scoreB })}
          >
            <Button
              disabled={loading || !scoreA || !scoreB}
              className={`w-full text-white font-bold uppercase text-xs ${isDisputed ? "bg-red-600" : "bg-purple-600"}`}
            >
              Примусово закрити
            </Button>
          </ConfirmModal>
        </div>
      )}
    </div>
  );
}
