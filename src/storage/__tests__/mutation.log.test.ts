import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../app', () => ({ queryClient: { invalidateQueries: () => undefined } }));
vi.mock('../bucket', () => ({ writeJson: async () => undefined }));

import { appendOperations, pruneCompactedOperations, readLocalLog } from '../mutation.log';
import { emptyState, mergedStateFrom } from '../mutations';

const useMemoryStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    });
};

describe('sequence numbers survive compaction', () => {
    beforeEach(useMemoryStorage);

    it('keeps counting up after the worker has absorbed every operation', () => {
        // Deleting a photo appends an operation, the nightly worker folds it into
        // the compacted state, and the local copy is pruned. If the next operation
        // restarted at seq 1 it would sit below the device's cursor, and both this
        // merge and the worker's would skip it forever: the photo would stay in the
        // gallery and nothing would say why.
        appendOperations([{ op: 'item.deleted', itemId: 7, value: '2026-09-01T10:00:00Z' }]);

        const compacted = mergedStateFrom(emptyState(), [readLocalLog()]);
        pruneCompactedOperations(compacted);
        expect(readLocalLog().ops).toHaveLength(0);

        appendOperations([{ op: 'item.deleted', itemId: 9, value: '2026-09-02T10:00:00Z' }]);

        const state = mergedStateFrom(compacted, [readLocalLog()]);
        expect(state.items['9']?.deleted?.value).toBe('2026-09-02T10:00:00Z');
    });

    it('climbs back above the cursor on a device the reset already stranded', () => {
        // Devices in the wild have a log full of low-numbered operations that no
        // merge will ever apply. Reading the compacted state has to lift them out
        // of that, or their next delete is skipped like all the ones before it.
        appendOperations([{ op: 'item.deleted', itemId: 7, value: '2026-09-01T10:00:00Z' }]);

        const compacted = { ...emptyState(), cursors: { [readLocalLog().deviceId]: 50 } };
        pruneCompactedOperations(compacted);

        appendOperations([{ op: 'item.deleted', itemId: 9, value: '2026-09-02T10:00:00Z' }]);

        expect(mergedStateFrom(compacted, [readLocalLog()]).items['9']?.deleted?.value)
            .toBe('2026-09-02T10:00:00Z');
    });
});
