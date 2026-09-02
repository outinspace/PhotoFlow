import { describe, expect, it } from 'vitest';
import { emptyState, mergedStateFrom, newAlbumId, DeviceLog, Operation } from '../mutations';

// These cases mirror worker/tests/test_compact.py one for one. The browser and the
// nightly compactor both merge the same logs, so if they ever disagree the gallery
// would show something different from what was compacted.

const log = (deviceId: string, ...ops: Operation[]): DeviceLog => ({ deviceId, ops });

const favorite = (seq: number, ts: string, itemId: number, value: boolean): Operation =>
    ({ seq, ts, op: 'item.favorite', itemId, value });

describe('merging device logs', () => {
    it('applies a favourite', () => {
        const state = mergedStateFrom(emptyState(), [log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true))]);

        expect(state.items['7'].favorite?.value).toBe(true);
    });

    it('lets the latest write win across devices', () => {
        const state = mergedStateFrom(emptyState(), [
            log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true)),
            log('laptop', favorite(1, '2026-08-01T11:00:00Z', 7, false))
        ]);

        expect(state.items['7'].favorite?.value).toBe(false);
    });

    it('does not depend on which log is read first', () => {
        const a = log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true));
        const b = log('laptop', favorite(1, '2026-08-01T11:00:00Z', 7, false));

        expect(mergedStateFrom(emptyState(), [a, b]).items).toEqual(mergedStateFrom(emptyState(), [b, a]).items);
    });

    it('keeps both photos when two devices add to one album at once', () => {
        const state = mergedStateFrom(emptyState(), [
            log('phone',
                { seq: 1, ts: '2026-08-01T10:00:00Z', op: 'album.create', albumId: 3, name: 'Trip' },
                { seq: 2, ts: '2026-08-01T10:00:01Z', op: 'album.member', albumId: 3, itemId: 100, value: true }),
            log('laptop',
                { seq: 1, ts: '2026-08-01T10:00:02Z', op: 'album.member', albumId: 3, itemId: 200, value: true })
        ]);

        expect(state.albums['3'].members!['100'].in?.value).toBe(true);
        expect(state.albums['3'].members!['200'].in?.value).toBe(true);
    });

    it('skips operations already folded into the compacted state', () => {
        const first = log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true));
        const compacted = mergedStateFrom(emptyState(), [first]);

        const again = mergedStateFrom(compacted, [first]);

        expect(again.cursors['phone']).toBe(1);
        expect(again.items['7'].favorite?.value).toBe(true);
    });

    it('applies an unfavourite that arrives after compaction', () => {
        const compacted = mergedStateFrom(emptyState(), [log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true))]);

        const state = mergedStateFrom(compacted, [
            log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true), favorite(2, '2026-08-02T10:00:00Z', 7, false))
        ]);

        expect(state.items['7'].favorite?.value).toBe(false);
    });

    it('records rename and delete on an album', () => {
        const state = mergedStateFrom(emptyState(), [
            log('phone',
                { seq: 1, ts: '2026-08-01T10:00:00Z', op: 'album.create', albumId: 3, name: 'Trip' },
                { seq: 2, ts: '2026-08-02T10:00:00Z', op: 'album.rename', albumId: 3, name: 'Iceland' },
                { seq: 3, ts: '2026-08-03T10:00:00Z', op: 'album.delete', albumId: 3 })
        ]);

        expect(state.albums['3'].name?.value).toBe('Iceland');
        expect(state.albums['3'].deleted?.value).toBe(true);
        expect(state.albums['3'].createdTimeUtc).toBe('2026-08-01T10:00:00Z');
    });

    it('treats delete and restore as the same field', () => {
        const state = mergedStateFrom(emptyState(), [
            log('phone',
                { seq: 1, ts: '2026-08-01T10:00:00Z', op: 'item.deleted', itemId: 7, value: '2026-08-01T10:00:00Z' },
                { seq: 2, ts: '2026-08-02T10:00:00Z', op: 'item.deleted', itemId: 7, value: null })
        ]);

        expect(state.items['7'].deleted?.value).toBeNull();
    });

    it('does not mutate the state it was given', () => {
        const compacted = mergedStateFrom(emptyState(), [log('phone', favorite(1, '2026-08-01T10:00:00Z', 7, true))]);
        const before = structuredClone(compacted);

        mergedStateFrom(compacted, [log('laptop', favorite(1, '2026-08-05T10:00:00Z', 7, false))]);

        expect(compacted).toEqual(before);
    });
});

describe('album ids', () => {
    it('stay within the range JavaScript can represent exactly', () => {
        for (let i = 0; i < 1000; i++) {
            const id = newAlbumId();
            expect(Number.isSafeInteger(id)).toBe(true);
            expect(id).toBeGreaterThanOrEqual(0);
        }
    });

    it('do not repeat', () => {
        const ids = new Set(Array.from({ length: 5000 }, () => newAlbumId()));
        expect(ids.size).toBe(5000);
    });
});
