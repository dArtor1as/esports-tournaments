import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Target, ArrowRightLeft } from 'lucide-react';
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
import PlayerTransfersHistory from '@/components/PlayerTransfersHistory';

export default function PlayerStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  const urlToken = searchParams.get('token');
  const { player, eloHistory, isLoading } = usePlayerStatsData(id);
  const [activeTab, setActiveTab] = useState(urlToken ? 'inbox' : 'analytics');

  if (isLoading)
    return (
      <div className="text-center py-20 text-esports-accent animate-pulse font-bold">
        Завантаження профілю...
      </div>
    );

  if (!player)
    return (
      <div className="text-center text-white py-20">Гравець не знайдений</div>
    );

  const isMyProfile = currentUser?.id === player.userId;
  const showInboxTab = isMyProfile && player.teamRole === 'CAPTAIN';
  const stats = player.stats || {};
  const flagUrl = getFlagUrl(player.user?.countryCode);
  const age = calculateAge(player.user?.birthDate);
  const kd = calculateKd(stats?.total_kills, stats?.total_deaths);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white px-0"
      >
        <ArrowLeft size={16} className="mr-2" /> Назад
      </Button>

      {/* РОЗБИТТЯ НА КОЛОНКИ: Зліва Картка, Справа Вкладки */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ЛІВА КОЛОНКА (Картка гравця) */}
        <div className="lg:col-span-1">
          <PlayerSummaryCard
            player={player}
            age={age}
            kd={kd}
            flagUrl={flagUrl}
          />
        </div>

        {/* ПРАВА КОЛОНКА (Вкладки зі статою та трансферами) */}
        <div className="lg:col-span-2">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex flex-wrap w-max gap-1 mb-4 h-auto">
              <TabsTrigger
                value="analytics"
                className="px-6 py-2 text-xs font-black uppercase tracking-wider data-[state=active]:bg-esports-primary data-[state=active]:text-black"
              >
                <Target size={14} className="mr-2" /> Статистика
              </TabsTrigger>

              <TabsTrigger
                value="transfers"
                className="px-6 py-2 text-xs font-black uppercase tracking-wider data-[state=active]:bg-esports-primary data-[state=active]:text-black"
              >
                <ArrowRightLeft size={14} className="mr-2" /> Трансфери
              </TabsTrigger>

              {showInboxTab && (
                <TabsTrigger
                  value="inbox"
                  className="px-6 py-2 text-xs font-black uppercase tracking-wider text-purple-400 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                >
                  <Mail size={14} className="mr-2" /> Вхідні інвайти
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="analytics" className="space-y-6">
              <PlayerStatsPanel
                stats={stats}
                hasStats={Object.keys(stats || {}).length > 0}
                isCS2={player.game?.slug === 'cs2'}
              />
            </TabsContent>

            <TabsContent value="transfers" className="space-y-6">
              <PlayerTransfersHistory playerId={player.id} />
            </TabsContent>

            {showInboxTab && (
              <TabsContent value="inbox">
                <Inbox />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* ГРАФІК ELO: Повноцінно внизу на всю ширину */}
      <div className="mt-6">
        <EloRatingChart
          historyData={eloHistory}
          title="Прогресія рейтингу ELO"
        />
      </div>
    </div>
  );
}
