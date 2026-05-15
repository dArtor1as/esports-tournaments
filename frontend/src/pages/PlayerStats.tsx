import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PlayerStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-esports-muted hover:text-white hover:bg-slate-800 mb-4"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад до профілю
      </Button>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-xl">
        <h1 className="text-3xl font-black text-white mb-2">
          Детальна статистика гравця
        </h1>
        <p className="text-esports-primary">ID профілю: {id}</p>

        <div className="mt-10 p-10 border-2 border-dashed border-slate-700 rounded-xl text-esports-muted">
          Тут ми скоро зверстаємо дашборд у стилі HLTV (ADR, KPR, Історія
          матчів).
          <br />
          Дані будемо тягнути з{" "}
          <code>/analytics/player/{id}/rating-history</code> та{" "}
          <code>/players/{id}</code>
        </div>
      </div>
    </div>
  );
}
