// Connection settings for the user's own bucket. There is no server and no
// account: everything the app needs to read and write lives here, in this
// browser. Reads go through publicBaseUrl and writes are signed against endpoint
// with the stored key.

export interface StorageConfig {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;

    // Both are derived when left empty, so the setup screen only has to ask for
    // the four things that cannot be worked out.
    region?: string;
    publicBaseUrl?: string;

    // Random prefix the catalog and mutation logs live under. Media keys are
    // content hashes and share keys are secrets, so both are already unguessable
    // and stay at the bucket root where the CDN can cache them. The catalog sits at
    // a fixed path, and on a public bucket that means anyone who guesses
    // "catalog/manifest.json" gets the whole index, GPS included. It has to match
    // PHOTOFLOW_PRIVATE_PREFIX in the worker's environment.
    privatePrefix?: string;
}

const STORAGE_CONFIG_KEY = 'photoflow.storage';

// Providers put the region in the endpoint hostname, so asking for it separately
// only creates a field to get wrong. A mismatch is also self-correcting: AWS
// replies with the region it expected, and the setup screen retries with it.
const REGION_PATTERNS = [
    /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/,
    /^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/,
    /^s3\.([a-z0-9-]+)\.wasabisys\.com$/,
    /^[a-z0-9-]+\.([a-z0-9-]+)\.digitaloceanspaces\.com$/,
];

export const deriveRegion = (endpoint: string): string => {
    let host: string;
    try {
        host = new URL(endpoint).host;
    } catch {
        return 'us-east-1';
    }

    // R2 is single-region and requires this literal.
    if (host.endsWith('.r2.cloudflarestorage.com')) {
        return 'auto';
    }

    for (const pattern of REGION_PATTERNS) {
        const match = host.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return 'us-east-1';
};

export const resolveRegion = (config: StorageConfig) => config.region || deriveRegion(config.endpoint);

// Keys already unguessable on their own: media is named by content hash, and a
// share document by the secret in its link. Both are read straight from the CDN by
// URL, which is what keeps the gallery fast, so neither moves.
const PUBLIC_PREFIXES = ['original/', 'tile-image/', 'preview/', 'share/'];

export const resolvePrivatePrefix = (config: StorageConfig | null) => {
    const prefix = config?.privatePrefix?.replace(/^\/+|\/+$/g, '');
    return prefix ? `${prefix}/` : '';
};

// Where a logical key actually lives. Every caller goes on naming objects the way
// keys.ts declares them, and this is the only place that knows the difference.
export const resolveKey = (config: StorageConfig | null, key: string) => {
    const prefix = resolvePrivatePrefix(config);
    if (!prefix || PUBLIC_PREFIXES.some(candidate => key.startsWith(candidate))) {
        return key;
    }
    return prefix + key;
};

// A key coming back from a listing, turned back into what the caller asked for. A
// listed key handed to readJson or writeObject would otherwise be prefixed twice.
// 128 bits, base32-ish. The whole scheme rests on this being unguessable, so it
// comes from the platform's CSPRNG rather than Math.random.
export const generatePrivatePrefix = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(36).padStart(2, '0')).join('');
};

export const stripPrivatePrefix = (config: StorageConfig | null, key: string) => {
    const prefix = resolvePrivatePrefix(config);
    return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
};

// Without a CDN the bucket serves its own files. That works, and is the right
// default for trying things out, but it is slower: see the note on the setup screen.
export const resolvePublicBaseUrl = (config: StorageConfig) =>
    trailingSlash(config.publicBaseUrl || `${config.endpoint}/${config.bucket}`);

const trailingSlash = (url: string) => url.replace(/\/+$/, '') + '/';

export const normalizeConfig = (config: StorageConfig): StorageConfig => ({
    ...config,
    endpoint: config.endpoint.trim().replace(/\/+$/, ''),
    bucket: config.bucket.trim(),
    publicBaseUrl: config.publicBaseUrl?.trim() ? trailingSlash(config.publicBaseUrl.trim()) : undefined,
    region: config.region?.trim() || undefined,
    privatePrefix: config.privatePrefix?.trim().replace(/^\/+|\/+$/g, '') || undefined,
});

export const getStorageConfig = (): StorageConfig | null => {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as StorageConfig;
    } catch {
        return null;
    }
};

export const saveStorageConfig = (config: StorageConfig) => {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalizeConfig(config)));
};

export const clearStorageConfig = () => localStorage.removeItem(STORAGE_CONFIG_KEY);

export const isConfigured = () => getStorageConfig() !== null;

// Throwing here keeps every caller on one path: if it returned, the app is set up.
export const requireStorageConfig = (): StorageConfig => {
    const config = getStorageConfig();
    if (!config) {
        throw new Error('Photoflow is not connected to a bucket yet.');
    }
    return config;
};
