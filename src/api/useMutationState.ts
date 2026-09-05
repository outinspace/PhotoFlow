import { useQuery } from '@tanstack/react-query';
import * as keys from '../storage/keys';
import { listKeys, readJson } from '../storage/bucket';
import { getDeviceId, pruneCompactedOperations, readLocalLog } from '../storage/mutation.log';
import { DeviceLog, emptyState, mergedStateFrom, MergedState } from '../storage/mutations';

// The mutable half of the library: what is favourited, what is deleted, and which
// photos are in which album. The worker compacts these nightly into state.json;
// anything newer still lives in per-device logs, including this device's, which is
// read locally so a tap shows up instantly.

export const fetchMutationState = async (): Promise<MergedState> => {
    const compacted = (await readJson<MergedState>(keys.META_STATE)) ?? emptyState();

    const deviceId = getDeviceId();
    const logKeys = await listKeys(keys.META_LOGS);

    const remote = await Promise.all(
        logKeys
            // This device's own log is read from local storage instead, so
            // mutations that have not been uploaded yet are still reflected.
            .filter(key => key.endsWith('.json') && key !== keys.deviceLog(deviceId))
            .map(key => readJson<DeviceLog>(key))
    );

    const logs = [...remote.filter((log): log is DeviceLog => !!log), readLocalLog()];

    pruneCompactedOperations(compacted);

    return mergedStateFrom(compacted, logs);
};

export const useMutationState = () => useQuery({
    queryKey: ['mutations'],
    staleTime: 30_000,
    queryFn: fetchMutationState
});
