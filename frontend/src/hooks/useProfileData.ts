import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Хук для сторінки гравця
export function usePlayerStatsData(playerId?: string) {
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: ["playerStats", playerId],
    queryFn: async () => (await api.get(`/players/${playerId}`)).data,
    enabled: !!playerId,
  });

  const { data: eloHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["playerEloHistory", playerId],
    queryFn: async () =>
      (await api.get(`/analytics/player/${playerId}/rating-history`)).data,
    enabled: !!playerId,
  });

  return { player, eloHistory, isLoading: isPlayerLoading || isHistoryLoading };
}

// Хук для сторінки команди
export function useTeamProfileData(teamId?: string) {
  const { data: team, isLoading: isTeamLoading } = useQuery({
    queryKey: ["teamProfile", teamId],
    queryFn: async () => (await api.get(`/teams/${teamId}`)).data,
    enabled: !!teamId,
  });

  const { data: teamEloHistory = [] } = useQuery({
    queryKey: ["teamEloHistory", teamId],
    queryFn: async () =>
      (await api.get(`/analytics/team/${teamId}/rating-history`)).data,
    enabled: !!teamId,
  });

  const { data: upcomingMatches = [] } = useQuery({
    queryKey: ["teamUpcomingMatches", teamId],
    queryFn: async () =>
      (await api.get(`/matches/team/${teamId}/upcoming`)).data,
    enabled: !!teamId,
  });

  const { data: historyMatchesData } = useQuery({
    queryKey: ["teamHistoryMatches", teamId],
    queryFn: async () =>
      (await api.get(`/matches/team/${teamId}/history?limit=20`)).data,
    enabled: !!teamId,
  });

  return {
    team,
    teamEloHistory,
    upcomingMatches,
    historyMatches: historyMatchesData?.data || [],
    isLoading: isTeamLoading,
  };
}
