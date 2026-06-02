import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WorkflowHeader from '@/components/admin-workflow/WorkflowHeader';
import WorkflowStats from '@/components/admin-workflow/WorkflowStats';
import WorkflowFilters from '@/components/admin-workflow/WorkflowFilters';
import WorkflowTable from '@/components/admin-workflow/WorkflowTable';

export default function AdminWorkflow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Захист роуту
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, navigate]);

  // Запит до бекенду
  const { data: workflowTournaments = [], isLoading } = useQuery({
    queryKey: ['adminWorkflow'],
    queryFn: async () => {
      const { data } = await api.get('/tournaments/workflow');
      return data;
    },
  });

  // СТАН ДЛЯ ФІЛЬТРІВ (З URL)
  const searchParam = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const gameFilter = searchParams.get('game') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const itemsPerPage = 10;
  const [searchValue, setSearchValue] = useState(searchParam);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || value === '' || (key === 'page' && value === '1')) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    if (key !== 'page') newParams.delete('page');
    setSearchParams(newParams);
  };

  // Debounce для пошуку
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      updateFilter('search', searchValue);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  // АГРЕГАЦІЯ СТАТИСТИКИ
  const stats = useMemo(() => {
    const counts = {
      planned: 0,
      live: 0,
      finished: 0,
      cancelled: 0,
      total: workflowTournaments.length,
    };
    workflowTournaments.forEach((t: any) => {
      if (counts[t.status as keyof typeof counts] !== undefined) {
        counts[t.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [workflowTournaments]);

  const chartData = [
    { name: 'Заплановані', value: stats.planned, color: '#3b82f6' },
    { name: 'LIVE', value: stats.live, color: '#ef4444' },
    { name: 'Завершені', value: stats.finished, color: '#64748b' },
    { name: 'Скасовані', value: stats.cancelled, color: '#f97316' },
  ].filter((item) => item.value > 0);

  // ФІЛЬТРАЦІЯ
  const filteredData = useMemo(() => {
    return workflowTournaments.filter((t: any) => {
      const matchSearch = t.title
        .toLowerCase()
        .includes(searchParam.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;

      let matchGame = true;
      if (gameFilter === 'cs2')
        matchGame = t.gameName.toLowerCase().includes('counter-strike');
      else if (gameFilter === 'dota2')
        matchGame = t.gameName.toLowerCase().includes('dota');

      return matchSearch && matchStatus && matchGame;
    });
  }, [workflowTournaments, searchParam, statusFilter, gameFilter]);

  // ПАГІНАЦІЯ
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchValue('');
  };

  if (isLoading) {
    return (
      <div className="text-center py-20 text-purple-500 animate-pulse font-bold text-xl">
        Завантаження диспетчерської панелі...
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    searchParam || statusFilter !== 'all' || gameFilter !== 'all',
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* КНОПКА "НАЗАД" */}
      <div className="-mb-2">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white px-0"
        >
          <ArrowLeft size={16} className="mr-2" /> Назад до турнірів
        </Button>
      </div>
      {/* ХЕДЕР */}
      <WorkflowHeader />

      <WorkflowStats stats={stats} chartData={chartData} />

      <WorkflowFilters
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        statusFilter={statusFilter}
        gameFilter={gameFilter}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <WorkflowTable
        data={paginatedData}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalFilteredCount={filteredData.length}
        updateFilter={updateFilter}
      />
    </div>
  );
}
