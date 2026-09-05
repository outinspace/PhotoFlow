import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../app', () => ({ queryClient: { invalidateQueries: () => undefined } }));

const objects = new Map<string, unknown>();

vi.mock('../../storage/bucket', () => ({
    readJson: async (key: string) => objects.get(key) ?? null,
    writeJson: async (key: string, value: unknown) => void objects.set(key, JSON.parse(JSON.stringify(value))),
    listKeys: async (prefix: string) => [...objects.keys()].filter(key => key.startsWith(prefix))
}));

import { fetchMutationState } from '../useMutationState';
import { appendOperations, readLocalLog } from '../../storage/mutation.log';
import * as keys from '../../storage/keys';
import { emptyState } from '../../storage/mutations';

const useMemoryStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    });
};

describe('what the gallery reads after a delete', () => {
    beforeEach(() => {
        objects.clear();
        useMemoryStorage();
    });

    it('reports a just-deleted photo as deleted', async () => {
        appendOperations([{ op: 'item.deleted', itemId: 7, value: '2026-09-05T10:00:00Z' }]);

        const state = await fetchMutationState();

        expect(state.items['7']?.deleted?.value).toBe('2026-09-05T10:00:00Z');
    });

    it('reports a just-deleted album as deleted', async () => {
        appendOperations([{ op: 'album.create', albumId: 3, name: 'Trip' }]);
        await fetchMutationState();
        appendOperations([{ op: 'album.delete', albumId: 3 }]);

        const state = await fetchMutationState();

        expect(state.albums['3']?.deleted?.value).toBe(true);
    });

    it('still reports it after the worker has compacted and pruned the log', async () => {
        appendOperations([{ op: 'item.favorite', itemId: 1, value: true }]);
        const first = await fetchMutationState();

        // The worker publishes what it absorbed; the next read prunes the local log.
        objects.set(keys.META_STATE, JSON.parse(JSON.stringify(first)));
        await fetchMutationState();

        appendOperations([{ op: 'item.deleted', itemId: 7, value: '2026-09-05T10:00:00Z' }]);
        const state = await fetchMutationState();

        expect(state.items['7']?.deleted?.value).toBe('2026-09-05T10:00:00Z');
    });
});

describe('a delete made before the first read completes', () => {
    beforeEach(() => {
        objects.clear();
        useMemoryStorage();
    });

    it('is not skipped on a device the worker has already read from', async () => {
        // A device that has been around a while: the worker has absorbed and
        // published a cursor for everything it ever sent, so its log is empty. Its
        // local counter is gone — it predates the counter being recorded at all.
        // The gallery renders from the persisted query cache, so a photo can be
        // deleted before the mutation query has finished its first read, which is
        // the only thing that recovers the cursor.
        const { deviceId } = readLocalLog();
        objects.set(keys.META_STATE, { ...emptyState(), cursors: { [deviceId]: 5 } });
        localStorage.removeItem('photoflow.seq');

        appendOperations([{ op: 'item.deleted', itemId: 7, value: '2026-09-05T10:00:00Z' }]);

        const state = await fetchMutationState();
        expect(state.items['7']?.deleted?.value).toBe('2026-09-05T10:00:00Z');
    });
});
