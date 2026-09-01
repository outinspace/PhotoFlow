// Favourites, deletions and album membership.
//
// There is no server to serialise these, so each device writes only its own log
// file and never touches another's. That removes write conflicts entirely — no
// locking, no read-modify-write, no conditional-put support needed from the
// storage provider. Conflicts are resolved when the logs are merged, last write
// wins per field, and the nightly worker folds them into meta/state.json.
//
// The merge below mirrors worker/photoflow/steps/compact.py. Both sides must
// agree, or the gallery would show something different from what was compacted.

export type OperationInput =
    | { op: 'item.favorite'; itemId: number; value: boolean }
    | { op: 'item.deleted'; itemId: number; value: string | null }
    | { op: 'album.create'; albumId: number; name: string }
    | { op: 'album.rename'; albumId: number; name: string }
    | { op: 'album.delete'; albumId: number }
    | { op: 'album.share'; albumId: number; secret: string }
    | { op: 'album.member'; albumId: number; itemId: number; value: boolean };

export type Operation = OperationInput & { seq: number; ts: string };

// Album ids are picked by whichever device creates the album, with no server to
// hand them out. 52 random bits makes a collision across a personal library
// vanishingly unlikely, and keeps the id an exact JavaScript integer.
export const newAlbumId = () =>
    Number(crypto.getRandomValues(new BigUint64Array(1))[0] >> 12n);

export interface DeviceLog {
    deviceId: string;
    ops: Operation[];
}

interface Versioned<T> {
    value: T;
    ts: string;
}

export interface AlbumState {
    albumId: number;
    createdTimeUtc?: string;
    name?: Versioned<string>;
    deleted?: Versioned<boolean>;
    shareSecret?: Versioned<string>;
    members?: Record<string, { in?: Versioned<boolean> }>;
}

export interface ItemState {
    favorite?: Versioned<boolean>;
    deleted?: Versioned<string | null>;
}

export interface MergedState {
    stateVersion: number;
    cursors: Record<string, number>;
    items: Record<string, ItemState>;
    albums: Record<string, AlbumState>;
}

export const emptyState = (): MergedState => ({
    stateVersion: 1,
    cursors: {},
    items: {},
    albums: {}
});

export const mergedStateFrom = (state: MergedState, logs: DeviceLog[]): MergedState => {
    const merged: MergedState = {
        stateVersion: state.stateVersion ?? 1,
        cursors: { ...state.cursors },
        items: structuredClone(state.items ?? {}),
        albums: structuredClone(state.albums ?? {})
    };

    const pending: { deviceId: string; op: Operation }[] = [];
    for (const log of logs) {
        if (!log?.deviceId) {
            continue;
        }
        const seen = merged.cursors[log.deviceId] ?? 0;
        for (const op of log.ops ?? []) {
            if (op.seq > seen) {
                pending.push({ deviceId: log.deviceId, op });
            }
        }
    }

    // Sorting by timestamp makes the result independent of the order the logs
    // happened to load in, so two devices converge on the same view.
    pending.sort((a, b) => (a.op.ts === b.op.ts ? a.deviceId.localeCompare(b.deviceId) : a.op.ts.localeCompare(b.op.ts)));

    for (const { deviceId, op } of pending) {
        applyOperation(merged, op);
        merged.cursors[deviceId] = Math.max(merged.cursors[deviceId] ?? 0, op.seq);
    }

    return merged;
};

const applyOperation = (state: MergedState, op: Operation) => {
    switch (op.op) {
        case 'item.favorite':
            setValue(itemState(state, op.itemId), 'favorite', op.value, op.ts);
            break;

        case 'item.deleted':
            setValue(itemState(state, op.itemId), 'deleted', op.value, op.ts);
            break;

        case 'album.create':
        case 'album.rename': {
            const album = albumState(state, op.albumId);
            if (op.op === 'album.create' && !album.createdTimeUtc) {
                album.createdTimeUtc = op.ts;
            }
            setValue(album, 'name', op.name, op.ts);
            break;
        }

        case 'album.delete':
            setValue(albumState(state, op.albumId), 'deleted', true, op.ts);
            break;

        case 'album.share':
            setValue(albumState(state, op.albumId), 'shareSecret', op.secret, op.ts);
            break;

        case 'album.member': {
            const album = albumState(state, op.albumId);
            album.members = album.members ?? {};
            // Membership is per photo rather than one list, so two devices adding
            // different photos to the same album do not overwrite each other.
            album.members[op.itemId] = album.members[op.itemId] ?? {};
            setValue(album.members[op.itemId], 'in', op.value, op.ts);
            break;
        }
    }
};

const itemState = (state: MergedState, itemId: number): ItemState =>
    (state.items[itemId] = state.items[itemId] ?? {});

const albumState = (state: MergedState, albumId: number): AlbumState =>
    (state.albums[albumId] = state.albums[albumId] ?? { albumId });

const setValue = <T extends object, K extends keyof T>(target: T, field: K, value: unknown, ts: string) => {
    const existing = target[field] as Versioned<unknown> | undefined;
    if (!existing || ts >= existing.ts) {
        target[field] = { value, ts } as T[K];
    }
};
