interface StatBarProps {
  label: string;
  value: number;
  max: number;
  status: 'GOOD' | 'AVERAGE' | 'POOR';
}

export default function StatBar({ label, value, max, status }: StatBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const statusConfig = {
    GOOD: { text: 'GOOD', bar: 'bg-green-500', textClass: 'text-green-500' },
    AVERAGE: {
      text: 'AVERAGE',
      bar: 'bg-yellow-500',
      textClass: 'text-yellow-500',
    },
    POOR: { text: 'POOR', bar: 'bg-red-500', textClass: 'text-red-500' },
  };

  const current = statusConfig[status];

  return (
    <div className="flex flex-col space-y-1 w-full mt-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className={current.textClass}>{current.text}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${current.bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
