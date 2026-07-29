import { useQuery } from "@tanstack/react-query";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export interface EventsStatus {
    pending: Record<string, number>;
    inFlight: Record<string, number>;
    failed: Record<string, number>;
    oldestPendingUtc: string | null;
}

export const useEventsStatus = () => useQuery({
    queryKey: ['system-status', 'events'],
    refetchInterval: 5_000,
    queryFn: async (): Promise<EventsStatus> => {
        const res = await fetchAuthenticatedRoute('/system-status/events');
        return res.json();
    },
});
