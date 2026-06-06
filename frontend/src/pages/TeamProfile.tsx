import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { useTeamProfileData } from '@/hooks/useProfileData';
import { getFlagUrl } from '@/lib/helpers';
import TeamHeader from '@/components/TeamHeader';
import TeamRosterTab from '@/components/TeamRosterTab';
import TeamMatchesTab from '@/components/TeamMatchesTab';
import EloRatingChart from '@/components/EloRatingChart';
import TeamTransfersTab from '@/components/TeamTransfersTab';

export default function TeamProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { team, teamEloHistory, upcomingMatches, historyMatches, isLoading } =
    useTeamProfileData(id);

  const handleTransferSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['teamProfile', id] });
    toast.success('Лідерство успішно передано!');
  };

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження профілю команди...
      </div>
    );
  if (!team)
    return (
      <div className="text-center py-20 text-red-500 font-bold">
        Команду не знайдено або її було розформовано.
      </div>
    );

  const isCaptain = team?.captain?.userId === currentUser?.id;
  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageRoles = isCaptain || isAdmin;

  // 1. ПРАВИЛЬНА ФІЛЬТРАЦІЯ (використовуємо teamRole для визначення активних гравців)
  const activePlayers =
    team.players?.filter(
      (p: any) => p.teamRole === 'PLAYER' || p.teamRole === 'CAPTAIN',
    ) || [];

  const coach = team.players?.find((p: any) => p.teamRole === 'COACH');

  // Знаходимо всіх запасних
  const allSubstitutes =
    team.players?.filter((p: any) => p.teamRole === 'SUBSTITUTE') || [];

  // 2. перевірка чи є юзер учасником цієї команди
  const isTeamMember = team.players?.some(
    (p: any) => p.userId === currentUser?.id,
  );

  // 3. Запасних бачать Адміни та всі учасники команди (гравці, тренери, самі запасні)
  const canSeeSubstitutes = isAdmin || isTeamMember;

  // 4. приховуємо запасних якщо немає прав, передаємо порожній масив
  const substitutes = canSeeSubstitutes ? allSubstitutes : [];

  const teamFlag = getFlagUrl(team.countryCode, 'w40');

  const handleDisband = async () => {
    try {
      await api.delete(`/teams/${id}`);
      toast.success('Команду успішно розформовано');
      navigate('/teams');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка при видаленні');
    }
  };

  const handleKick = async (playerId: string) => {
    try {
      await api.delete(`/teams/${id}/kick/${playerId}`);
      // Оновлюємо поточну сторінку команди (склад і статус isComplete)
      await queryClient.invalidateQueries({ queryKey: ['teamProfile', id] });
      // Оновлюємо глобальний список гравців, щоб статус змінився на "Вільний агент"
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      // Оновлюємо загальний список команд, бо статус змінився
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['allTeams'] });
      }, 3100);
      toast.success('Гравця виключено зі складу');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Помилка при виключенні');
    }
  };

  const handleLeave = async (playerId: string) => {
    try {
      await api.delete(`/teams/${id}/leave/${playerId}`);
      await queryClient.invalidateQueries({ queryKey: ['teamProfile', id] });
      await queryClient.invalidateQueries({ queryKey: ['players'] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['allTeams'] });
      }, 3100);
      navigate('/teams');
      toast.success('Ви успішно покинули команду');
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Помилка при виході з команди',
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      <TeamHeader
        team={team}
        teamFlag={teamFlag}
        isCaptain={isCaptain}
        isAdmin={isAdmin}
        onDisband={handleDisband}
        onTransferSuccess={handleTransferSuccess}
      />

      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex w-full md:w-max mb-4">
          <TabsTrigger
            value="roster"
            className="flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Склад ростера
          </TabsTrigger>
          <TabsTrigger
            value="transfers"
            className="flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Трансфери
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Розклад & Матчі
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            className="flex-1 md:flex-none px-6 py-2 text-xs font-black uppercase tracking-wider"
          >
            Аналітика Elo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster">
          <TeamRosterTab
            activePlayers={activePlayers}
            coach={coach}
            team={team}
            currentUser={currentUser}
            isCaptain={canManageRoles}
            onKick={handleKick}
            onLeave={handleLeave}
            substitutes={substitutes}
          />
        </TabsContent>

        <TabsContent value="transfers">
          {' '}
          <TeamTransfersTab teamId={team.id} />{' '}
        </TabsContent>

        <TabsContent value="matches">
          <TeamMatchesTab
            upcomingMatches={upcomingMatches}
            historyMatches={historyMatches}
            teamId={team.id}
            teamTag={team.tag}
            teamName={team.name}
          />
        </TabsContent>

        <TabsContent value="stats">
          <EloRatingChart
            historyData={teamEloHistory}
            title="Прогресія командного рейтингу за сезони"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
