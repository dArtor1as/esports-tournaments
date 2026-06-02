import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Cpu, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function AdminWorkflow() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Додаткова перевірка безпеки на рівні компонента
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, navigate]);

  // Запит до твого контролера TournamentsWorkflowController
  const { data: workflowData, isLoading } = useQuery({
    queryKey: ['adminWorkflow'],
    queryFn: async () => {
      const { data } = await api.get('/tournaments/workflow');
      return data; // Тут повернеться масив з id, title, status, groupMatches, playoffMatches тощо
    },
  });

  if (isLoading)
    return (
      <div className="text-center py-10 text-white">Завантаження панелі...</div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <Cpu className="text-esports-accent" />
          Студія управління турнірами
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Контроль генерації сіток та аналітики результатів симуляцій.
        </p>
      </div>

      {/* Тут ти зможеш побудувати таблицю або грід з турнірами, 
          використовуючи workflowData, і додати кнопки "Згенерувати тестовий турнір" */}
    </div>
  );
}
