import { del, get, keys as idbKeys, set } from 'idb-keyval';
import { Item } from '../types';
import * as keys from './keys';
import { readJson } from './bucket';

// The catalog replaces what used to be a GET /items call. It is a manifest plus
// one JSON shard per upload month, written by the nightly worker.
//
// Sharding on upload month (not capture month) means a month stops changing once
// it is over, so the browser keeps it forever and each visit only fetches the
// manifest and whatever month is current.

export interface ShardEntry {
    month: string;
    items: number;
    updatedAt: string;
}

export interface Manifest {
    manifestVersion: number;
    generatedAt: string;
    urls: {
        originalPrefix: string;
        tileImagePrefix: string;
        previewPrefix: string;
    };
    shards: ShardEntry[];
    embeddings: { dim: number; dtype: string; modelRepo: string; months: string[] };
    counts: { items: number; files: number };
}

export interface Catalog {
    manifest: Manifest;
    items: Item[];
}

interface CachedShard {
    updatedAt: string;
    items: Item[];
}

const shardCacheKey = (month: string) => `photoflow.shard.${month}`;

export const fetchCatalog = async (signal?: AbortSignal): Promise<Catalog> => {
    const manifest = await readJson<Manifest>(keys.CATALOG_MANIFEST, signal);

    if (!manifest) {
        // A bucket with no manifest yet is a valid empty library, not an error —
        // it is what every new install looks like until the first run finishes.
        return { manifest: emptyManifest(), items: [] };
    }

    const shards = await Promise.all(
        manifest.shards.map(entry => loadShard(entry, signal))
    );

    return { manifest, items: shards.flat() };
};

const loadShard = async (entry: ShardEntry, signal?: AbortSignal): Promise<Item[]> => {
    const cached = await get<CachedShard>(shardCacheKey(entry.month));
    if (cached?.updatedAt === entry.updatedAt) {
        return cached.items;
    }

    const shard = await readJson<{ items: Item[] }>(keys.shard(entry.month), signal);
    const items = shard?.items ?? [];

    await set(shardCacheKey(entry.month), { updatedAt: entry.updatedAt, items } satisfies CachedShard);

    return items;
};

// Cached shards belong to one bucket. Pointing the app at a different bucket — or
// disconnecting entirely — has to drop them, or the gallery would go on showing a
// library that is no longer the one being read, and in the disconnect case one that
// the next person at this browser should not see.
export const clearCachedCatalog = async () => {
    const cached = await idbKeys();

    await Promise.all(
        cached
            .filter(key => String(key).startsWith('photoflow.shard.'))
            .map(key => del(key))
    );
};

const emptyManifest = (): Manifest => ({
    manifestVersion: 1,
    generatedAt: new Date(0).toISOString(),
    urls: { originalPrefix: '', tileImagePrefix: '', previewPrefix: '' },
    shards: [],
    embeddings: { dim: 512, dtype: 'int8', modelRepo: '', months: [] },
    counts: { items: 0, files: 0 }
});
