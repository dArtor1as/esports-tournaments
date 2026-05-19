import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Target } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EloRatingChart from '@/components/EloRatingChart';
import PlayerSummaryCard from '@/components/PlayerSummaryCard';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import { usePlayerStatsData } from '@/hooks/useProfileData';
import { useAuth } from '@/context/AuthContext';
import { calculateAge, getFlagUrl, calculateKd } from '@/lib/helpers';
import Inbox from '@/pages/Inbox';

export default function PlayerStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  // Перевіряємо, чи є в URL токен з листа Mailtrap
  const urlToken = searchParams.get('token');

  const { player, eloHistory, isLoading } = usePlayerStatsData(id);

  // Автоматично відкриваємо потрібну вкладку, якщо користувач перейшов за посиланням з пошти
  const [activeTab, setActiveTab] = useState(urlToken ? 'inbox' : 'analytics');

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold text-xl">
        Завантаження аналітики...
      </div>
    );
  if (!player)
    return (
      <div className="text-center py-20 text-red-500">Гравця не знайдено</div>
    );

  const stats = player.stats || {};
  const age = calculateAge(player.user?.birthDate);
  const kd = calculateKd(stats.total_kills, stats.total_deaths);
  const flagUrl = getFlagUrl(player.user?.countryCode, 'w40');

  // Перевірка чи це профіль поточного юзера і чи він є капітаном своєї команди
  const isMyProfile = player.userId === currentUser?.id;
  const isCaptain = player.team?.captainId === player.id;
  const showInboxTab = isMyProfile && isCaptain;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white mb-2"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PlayerSummaryCard
            player={player}
            age={age}
            kd={kd}
            flagUrl={flagUrl}
          />
        </div>

        {/* ПРАВА ЧАСТИНА: АНАЛІТИКА ТА ІНБОКС */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex w-max mb-4">
              <TabsTrigger
                value="analytics"
                className="px-6 py-2 text-xs font-black uppercase tracking-wider"
              >
                <Target size={14} className="mr-2" /> Статистика та ELO
              </TabsTrigger>

              {/* Рендеримо таб Інбоксу для власника-капітана */}
              {showInboxTab && (
                <TabsTrigger
                  value="inbox"
                  className="px-6 py-2 text-xs font-black uppercase tracking-wider text-purple-400"
                >
                  <Mail size={14} className="mr-2" /> Вхідні інвайти
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="analytics" className="space-y-6">
              <PlayerStatsPanel
                stats={stats}
                hasStats={Object.keys(stats).length > 0}
                isCS2={player.game?.slug === 'cs2'}
              />
              <EloRatingChart
                historyData={eloHistory}
                title="Прогресія рейтингу ELO"
              />
            </TabsContent>

            {showInboxTab && (
              <TabsContent value="inbox">
                <Inbox />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
