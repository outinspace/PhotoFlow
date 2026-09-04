// Connection settings for the user's own bucket. There is no server and no
// account: everything the app needs lives here, in this browser.
//
// This is also the only place a bucket is named. The bucket is private, so every
// URL is signed from these four values at the moment it is needed — nothing in the
// built app, and nothing served alongside it, refers to any particular bucket.
// That is what lets one deployment serve any number of people.

export interface StorageConfig {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;

    // Derived from the endpoint when left empty, so the setup screen only has to
    // ask for the four things that cannot be worked out.
    region?: string;

    // A CDN in front of the bucket, used for pictures only. Optional, and stored
    // here rather than anywhere in the deployment, so each person can point at
    // their own. See resolveMediaBaseUrl for what it does and does not cover.
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

const trailingSlash = (url: string) => url.replace(/\/+$/, '') + '/';

/**
 * Where pictures are read from: a CDN if one is configured, otherwise the bucket.
 *
 * Only pictures. The catalog, the mutation logs and every write go to the bucket
 * endpoint regardless, so a CDN that is misconfigured leaves the app working with
 * slow images rather than not working at all.
 *
 * The URL is signed for whatever host this produces, because SigV4 covers the Host
 * header. A CDN therefore has to pass both the host and the path through to the
 * bucket unchanged, or storage computes a different signature and refuses. The
 * connect screen checks exactly that.
 */
export const resolveMediaBaseUrl = (config: StorageConfig) =>
    trailingSlash(config.publicBaseUrl || `${config.endpoint}/${config.bucket}`);

/** The bucket's own address, which every read that is not a picture uses. */
export const bucketBaseUrl = (config: StorageConfig) => `${config.endpoint}/${config.bucket}/`;

// A bucket name that is also a valid DNS label. One that is not — anything with a
// dot, or in capitals — cannot form a hostname, and a dot would break the
// wildcard certificate every provider serves.
const DNS_LABEL = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/**
 * The same bucket reached under its own hostname, or null where it has none.
 *
 * S3 accepts both `endpoint/bucket/key` and `bucket.endpoint/key`, and they are
 * two hostnames as far as the browser is concerned. That matters because a bucket
 * endpoint speaks HTTP/1.1, where browsers allow about six connections per
 * hostname: splitting pictures across both doubles what the gallery can load at
 * once, with nothing to configure and no change at the provider.
 *
 * Not every endpoint has this form. A hostname with no dot is a bare host such as
 * a development MinIO on localhost, and one ending in a digit is an IP address;
 * neither resolves with a bucket prefixed to it. Whatever survives those checks is
 * still only a candidate — see the probe in bucket.ts, which proves it before any
 * picture depends on it.
 */
export const virtualHostBaseUrl = (config: StorageConfig): string | null => {
    if (!DNS_LABEL.test(config.bucket)) {
        return null;
    }

    try {
        const { protocol, host, hostname } = new URL(config.endpoint);
        if (!hostname.includes('.') || !/[a-z]$/i.test(hostname)) {
            return null;
        }

        return `${protocol}//${config.bucket}.${host}/`;
    } catch {
        return null;
    }
};

export const normalizeConfig = (config: StorageConfig): StorageConfig => ({
    ...config,
    endpoint: config.endpoint.trim().replace(/\/+$/, ''),
    bucket: config.bucket.trim(),
    region: config.region?.trim() || undefined,
    publicBaseUrl: config.publicBaseUrl?.trim() ? trailingSlash(config.publicBaseUrl.trim()) : undefined,
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
