import { BarChart3 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface WorkflowStatsProps {
  stats: {
    planned: number;
    live: number;
    finished: number;
    cancelled: number;
    total: number;
  };
  chartData: { name: string; value: number; color: string }[];
}

export default function WorkflowStats({
  stats,
  chartData,
}: WorkflowStatsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* ГРАФІК */}
      <div className="xl:col-span-1 bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg flex flex-col items-center justify-center min-h-[250px]">
        <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-4 w-full text-left flex items-center gap-2">
          <BarChart3 size={16} /> Розподіл статусів
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  color: '#fff',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 italic flex-1 flex items-center">
            Немає даних для графіка
          </div>
        )}
      </div>

      {/* ПЛАШКИ (5 КОЛОНОК) */}
      <div className="xl:col-span-2 grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-center border-b-4 border-b-slate-700">
          <span className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">
            Всього
          </span>
          <span className="text-4xl font-black text-white">{stats.total}</span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-center border-b-4 border-b-blue-500">
          <span className="text-blue-400 text-[10px] font-black uppercase tracking-wider mb-1">
            Заплановано
          </span>
          <span className="text-4xl font-black text-white">
            {stats.planned}
          </span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-center border-b-4 border-b-red-500">
          <span className="text-red-500 text-[10px] font-black uppercase tracking-wider mb-1">
            LIVE (Активні)
          </span>
          <span className="text-4xl font-black text-white">{stats.live}</span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-center border-b-4 border-b-slate-500">
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-1">
            Завершено
          </span>
          <span className="text-4xl font-black text-white">
            {stats.finished}
          </span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg flex flex-col justify-center border-b-4 border-b-orange-500">
          <span className="text-orange-500 text-[10px] font-black uppercase tracking-wider mb-1">
            Скасовано
          </span>
          <span className="text-4xl font-black text-white">
            {stats.cancelled}
          </span>
        </div>
      </div>
    </div>
  );
}
