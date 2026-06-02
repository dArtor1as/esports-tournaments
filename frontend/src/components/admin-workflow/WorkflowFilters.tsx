import { Search, FilterX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WorkflowFiltersProps {
  searchValue: string;
  setSearchValue: (val: string) => void;
  statusFilter: string;
  gameFilter: string;
  updateFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export default function WorkflowFilters({
  searchValue,
  setSearchValue,
  statusFilter,
  gameFilter,
  updateFilter,
  resetFilters,
  hasActiveFilters,
}: WorkflowFiltersProps) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          size={16}
        />
        <Input
          placeholder="Пошук турніру за назвою..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 bg-slate-950 border-slate-800 text-white h-10"
        />
      </div>

      <Select
        value={statusFilter}
        onValueChange={(val) => updateFilter('status', val)}
      >
        <SelectTrigger className="w-[160px] bg-slate-950 border-slate-800 text-white h-10">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-white">
          <SelectItem value="all">Всі статуси</SelectItem>
          <SelectItem value="planned">Заплановані</SelectItem>
          <SelectItem value="live">LIVE</SelectItem>
          <SelectItem value="finished">Завершені</SelectItem>
          <SelectItem value="cancelled">Скасовані</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={gameFilter}
        onValueChange={(val) => updateFilter('game', val)}
      >
        <SelectTrigger className="w-[160px] bg-slate-950 border-slate-800 text-white h-10">
          <SelectValue placeholder="Дисципліна" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-white">
          <SelectItem value="all">Всі ігри</SelectItem>
          <SelectItem value="cs2">Counter-Strike 2</SelectItem>
          <SelectItem value="dota2">Dota 2</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={resetFilters}
          className="text-slate-400 hover:text-white h-10"
        >
          <FilterX size={16} className="mr-2" /> Скинути
        </Button>
      )}
    </div>
  );
}
