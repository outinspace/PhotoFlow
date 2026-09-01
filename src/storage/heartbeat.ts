import { useQuery } from '@tanstack/react-query';
import * as keys from './keys';
import { readJson } from './bucket';

// Without a server there is nothing to alert on a pipeline that quietly stopped
// running, so the app surfaces the worker's own record of its last run.

export interface Heartbeat {
    finishedAt: string;
    ok: boolean;
    steps: { name: string; seconds: number; failed: boolean }[];
    notes: string[];
    itemCount: number;
}

export const useHeartbeat = () => useQuery({
    queryKey: ['heartbeat'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => readJson<Heartbeat>(keys.META_HEARTBEAT)
});
