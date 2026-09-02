// The object keys the worker writes and this app reads. Mirrors
// worker/photoflow/keys.py — changing one means changing both.

export const INCOMING = 'incoming/';
export const CATALOG_MANIFEST = 'catalog/manifest.json';
export const META_STATE = 'meta/state.json';
export const META_LOGS = 'meta/log/';
export const META_HEARTBEAT = 'meta/heartbeat.json';
export const META_REPROCESS = 'meta/reprocess/';

// A month too large for one file is split into parts. The first keeps the plain
// name, so a catalog written before splitting existed still reads correctly.
export const shard = (month: string, part = 1) =>
    `catalog/shards/${month}${part > 1 ? `.p${part}` : ''}.json`;
export const embeddings = (month: string) => `catalog/embeddings/${month}.bin`;
export const deviceLog = (deviceId: string) => `${META_LOGS}${deviceId}.json`;
export const reprocessRequest = (fileId: string) => `${META_REPROCESS}${fileId}.json`;
