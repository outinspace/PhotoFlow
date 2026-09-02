import { AwsClient } from 'aws4fetch';
import { getStorageConfig, requireStorageConfig, resolvePublicBaseUrl, resolveRegion, StorageConfig } from './config';
import { getLoadedRuntimeConfig } from './runtime.config';

// Reads (readJson, readBinary, and every <img> in the app) go through the CDN in
// front of the bucket. That gives HTTP/2+3 multiplexing, so a fast scroll can have
// hundreds of thumbnails in flight; hitting the bucket's own endpoint would cap
// the browser at roughly six connections per host.
//
// Writes are signed with the user's key and must go to the S3 endpoint directly.
// They are rare and small — an upload, or a mutation log — so latency there is
// not what the gallery's smoothness depends on.

// Signing needs WebCrypto, which browsers only expose in a secure context: HTTPS,
// or plain http on localhost / 127.0.0.1 exactly. Served over http from any other
// hostname — a LAN address for phone testing, or a custom local domain — the whole
// crypto.subtle object is simply absent, and the signing library fails deep inside
// with an unreadable TypeError. Say what is actually wrong instead.
export const canSignRequests = () => typeof crypto !== 'undefined' && !!crypto.subtle;

const assertCanSign = () => {
    if (canSignRequests()) {
        return;
    }

    throw new Error(
        `Photoflow cannot sign requests over an insecure connection (${window.location.origin}). ` +
        'Browsers only provide the crypto this needs over HTTPS, or over http on localhost. ' +
        'Open the app at http://localhost, or serve it over HTTPS.'
    );
};

let client: AwsClient | null = null;
let clientKey = '';

const awsClient = (config: StorageConfig) => {
    assertCanSign();

    const region = resolveRegion(config);
    const key = `${config.accessKeyId}:${region}`;
    if (!client || clientKey !== key) {
        client = new AwsClient({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            region,
            service: 's3'
        });
        clientKey = key;
    }
    return client;
};

const objectUrl = (config: StorageConfig, key: string) =>
    `${config.endpoint}/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

// A share link is opened by people who have never set the app up, so reads fall
// back to the deployment's own settings, and finally to the app's own origin —
// which is correct whenever the app and the photos share a domain.
export const publicBaseUrl = () => {
    const config = getStorageConfig();
    if (config) {
        return resolvePublicBaseUrl(config);
    }

    const configured = getLoadedRuntimeConfig()?.publicBaseUrl || window.location.origin;
    return configured.replace(/\/+$/, '') + '/';
};

export const publicUrl = (key: string) => publicBaseUrl() + key;

export const readJson = async <T>(key: string, signal?: AbortSignal): Promise<T | null> => {
    const res = await fetch(publicUrl(key), { signal });

    if (res.status === 404 || res.status === 403) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to read ${key} (${res.status})`);
    }

    return await res.json() as T;
};

export const readBinary = async (key: string, signal?: AbortSignal): Promise<ArrayBuffer | null> => {
    const res = await fetch(publicUrl(key), { signal });

    if (res.status === 404 || res.status === 403) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to read ${key} (${res.status})`);
    }

    return await res.arrayBuffer();
};

export const writeObject = async (key: string, body: BodyInit, contentType: string) => {
    const config = requireStorageConfig();

    const res = await awsClient(config).fetch(objectUrl(config, key), {
        method: 'PUT',
        body,
        headers: { 'Content-Type': contentType }
    });

    if (!res.ok) {
        throw new Error(`Failed to write ${key} (${res.status})`);
    }
};

export const writeJson = (key: string, value: unknown) =>
    writeObject(key, JSON.stringify(value), 'application/json');

export const objectExists = async (key: string) => {
    const config = requireStorageConfig();

    const res = await awsClient(config).fetch(objectUrl(config, key), { method: 'HEAD' });
    return res.ok;
};

export const listResponse = (prefix: string, config: StorageConfig) => {
    const params = new URLSearchParams({ 'list-type': '2', prefix });
    return awsClient(config).fetch(`${config.endpoint}/${config.bucket}?${params.toString()}`);
};

export interface ListedObject {
    key: string;
    size: number;
}

export interface Listing {
    objects: ListedObject[];
    // S3 returns at most 1000 keys per request. Nothing here pages beyond the
    // first, so callers can say "1000+" rather than quietly under-reporting.
    truncated: boolean;
}

export const listObjects = async (prefix: string, override?: StorageConfig): Promise<Listing> => {
    const config = override ?? requireStorageConfig();

    const res = await listResponse(prefix, config);
    if (!res.ok) {
        throw new Error(`Failed to list ${prefix} (${res.status})`);
    }

    const document = new DOMParser().parseFromString(await res.text(), 'text/xml');

    const objects = Array.from(document.getElementsByTagName('Contents')).map(node => ({
        key: node.getElementsByTagName('Key')[0]?.textContent ?? '',
        size: Number(node.getElementsByTagName('Size')[0]?.textContent ?? 0)
    }));

    return {
        objects,
        truncated: document.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
    };
};

export const listKeys = async (prefix: string, override?: StorageConfig): Promise<string[]> => {
    const { objects } = await listObjects(prefix, override);
    return objects.map(object => object.key);
};
