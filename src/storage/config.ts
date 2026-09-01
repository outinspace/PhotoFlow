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
