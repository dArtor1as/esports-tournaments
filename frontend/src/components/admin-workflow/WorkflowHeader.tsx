import { Cpu } from 'lucide-react';
import TournamentFormModal from '@/components/tournament/TournamentFormModal';

export default function WorkflowHeader() {
  return (
    <div className="bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-purple-500/10 to-transparent pointer-events-none"></div>
      <div className="relative z-10">
        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight uppercase">
          <Cpu className="text-purple-500" size={32} />
          Workflow Control
        </h1>
        <p className="text-slate-400 mt-2">
          Глобальна аналітика, керування стадіями турнірів та генерація тестових
          даних.
        </p>
      </div>
      <div className="relative z-10 flex w-full md:w-auto">
        <TournamentFormModal mode="test" />
      </div>
    </div>
  );
}
