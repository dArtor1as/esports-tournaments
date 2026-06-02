import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTournamentDetailsData(tournamentId?: string) {
  // 1. Деталі турніру
  const {
    data: tournament,
    isLoading: isTournamentLoading,
    refetch: refetchTournament,
  } = useQuery({
    queryKey: ['tournamentDetails', tournamentId], // Ось твій справжній ключ!
    queryFn: async () => (await api.get(`/tournaments/${tournamentId}`)).data,
    enabled: !!tournamentId,
  });

  // 2. Список учасників (команд)
  const { data: participants = [], isLoading: isParticipantsLoading } =
    useQuery({
      queryKey: ['tournamentParticipants', tournamentId],
      queryFn: async () =>
        (await api.get(`/tournament-participants/tournament/${tournamentId}`))
          .data,
      enabled: !!tournamentId,
    });

  // 3. Матчі турніру (сітка)
  const {
    data: matches = [],
    isLoading: isMatchesLoading,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ['tournamentMatches', tournamentId],
    queryFn: async () =>
      (await api.get(`/matches/tournament/${tournamentId}`)).data,
    enabled: !!tournamentId,
  });

  return {
    tournament,
    participants,
    matches,
    refetchMatches,
    refetchTournament,
    isLoading: isTournamentLoading || isParticipantsLoading || isMatchesLoading,
  };
}
