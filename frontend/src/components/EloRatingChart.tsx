import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface HistoryItem {
  createdAt: string;
  newRating: number;
  ratingChange: number;
  match?: {
    tournament?: {
      title: string;
    };
  };
}

interface EloRatingChartProps {
  historyData: HistoryItem[];
  title?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.change >= 0;

    return (
      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-2xl text-xs space-y-2 min-w-[180px]">
        <p className="font-black text-white truncate max-w-[200px]">
          {data.tournamentTitle}
        </p>
        <p className="text-slate-500 font-medium">{data.displayDate}</p>
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
          <span className="text-slate-400 font-medium">Рейтинг Elo:</span>
          <span className="text-yellow-400 font-black text-sm drop-shadow-[0_0_4px_rgba(250,204,21,0.2)]">
            {data.Elo}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Зміна:</span>
          <span
            className={`font-black text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {isPositive ? `+${data.change}` : data.change}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function EloRatingChart({
  historyData,
  title = 'Історія зміни рейтингу Elo',
}: EloRatingChartProps) {
  const chartData = historyData.map((item, idx) => ({
    index: idx + 1,
    displayDate: new Date(item.createdAt).toLocaleDateString(),
    tournamentTitle: item.match?.tournament?.title || 'Товариський матч',
    Elo: item.newRating,
    change: item.ratingChange,
  }));

  if (chartData.length < 2) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm italic bg-slate-950/20 border border-slate-800/60 border-dashed rounded-xl">
        Недостатньо зіграних матчів для побудови кривої прогресу рейтингу
        (потрібно хоча б 2 точки).
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="text-esports-accent" size={20} /> {title}
      </h3>
      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="index"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={['dataMin - 50', 'dataMax + 50']}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: '#334155',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            <Line
              type="monotone"
              dataKey="Elo"
              stroke="#F2A71B"
              strokeWidth={3}
              activeDot={{ r: 6, stroke: '#011F26', strokeWidth: 2 }}
              dot={{ stroke: '#011F26', strokeWidth: 2, r: 4, fill: '#F2A71B' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
