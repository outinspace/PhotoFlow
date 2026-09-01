// The object keys the worker writes and this app reads. Mirrors
// worker/photoflow/keys.py — changing one means changing both.

export const INCOMING = 'incoming/';
export const CATALOG_MANIFEST = 'catalog/manifest.json';
export const META_STATE = 'meta/state.json';
export const META_LOGS = 'meta/log/';
export const META_HEARTBEAT = 'meta/heartbeat.json';

export const shard = (month: string) => `catalog/shards/${month}.json`;
export const embeddings = (month: string) => `catalog/embeddings/${month}.bin`;
export const deviceLog = (deviceId: string) => `${META_LOGS}${deviceId}.json`;
