import { AwsClient } from 'aws4fetch';
import { getStorageConfig, requireStorageConfig, resolveRegion, StorageConfig } from './config';

// The bucket is private, so nothing in it can be read without a signature. Every
// read here — the catalog, the mutation logs, and every thumbnail the gallery
// renders — is a presigned GET signed in this browser with the user's own key.
// There is no server to sign on anyone's behalf.
//
// That is what lets the catalog live at fixed, guessable paths: a shard is worth
// nothing without a key, so leaking one costs nothing, and deleting the key ends
// access to everything signed with it.
//
// Writes carry the signature in the Authorization header instead, which is what
// S3 expects for a PUT.

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
    // Every field the signature depends on, not just the key id: rotating a secret
    // while keeping the same id would otherwise go on signing with the old one
    // until the page was reloaded.
    const key = `${config.accessKeyId}:${config.secretAccessKey}:${region}`;
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

// A source may carry a cache-busting query (`?t=...`), which has to be part of the
// URL before it is signed: SigV4 covers every query parameter, so appending one
// afterwards would invalidate the signature.
const objectUrl = (config: StorageConfig, key: string) => {
    const [path, query] = key.split('?');
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `${config.endpoint}/${config.bucket}/${encoded}${query ? `?${query}` : ''}`;
};

// SigV4 will not presign anything for longer than seven days, because the signing
// key is derived from the date. Nothing here needs longer: the app re-signs
// whenever it likes, and a share link is deliberately temporary.
const SIGNED_READ_TTL_SECONDS = 7 * 24 * 60 * 60;

// The signing timestamp is pinned to midnight UTC, so one object yields one URL
// for the whole day on every device. Signing per request would instead give every
// thumbnail a new URL each time it scrolled into view, making it a fresh download
// and a fresh service-worker cache entry every time.
const signingStamp = () => `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}T000000Z`;

// Keyed by everything the signature depends on, so rotating a secret or pointing
// at another bucket cannot serve a URL signed for the old one.
const signedUrls = new Map<string, string>();

const signatureCacheKey = (config: StorageConfig, key: string, stamp: string) =>
    `${stamp}|${config.endpoint}|${config.bucket}|${config.accessKeyId}|${key}`;

// A source is either a bucket key, which this browser signs, or an absolute URL
// that was signed elsewhere — which is what a share document carries, since the
// person opening it has no credentials of their own.
const isAbsolute = (source: string) => /^https?:\/\//i.test(source);

/** A signed URL if one is already in hand, without signing anything. */
export const peekMediaUrl = (source: string): string | null => {
    if (isAbsolute(source)) {
        return source;
    }

    const config = getStorageConfig();
    if (!config) {
        return null;
    }

    return signedUrls.get(signatureCacheKey(config, source, signingStamp())) ?? null;
};

/**
 * A presigned GET URL, signed with a config passed in rather than the stored one.
 *
 * The setup screen needs this: it has to prove a connection works before it saves
 * anything, so at that point there is no stored config to sign with.
 */
export const presignWith = async (config: StorageConfig, key: string): Promise<string> => {
    const stamp = signingStamp();
    const cacheKey = signatureCacheKey(config, key, stamp);

    const cached = signedUrls.get(cacheKey);
    if (cached) {
        return cached;
    }

    const url = new URL(objectUrl(config, key));
    url.searchParams.set('X-Amz-Expires', String(SIGNED_READ_TTL_SECONDS));

    const signed = await awsClient(config).sign(url.toString(), {
        method: 'GET',
        aws: { signQuery: true, datetime: stamp }
    });

    signedUrls.set(cacheKey, signed.url);
    return signed.url;
};

/** A URL the browser can load for a bucket key, signing it if necessary. */
export const mediaUrl = async (source: string): Promise<string> =>
    isAbsolute(source) ? source : presignWith(requireStorageConfig(), source);

/** Thrown when storage refused a signature, rather than merely lacking the object. */
export class AccessRejected extends Error {}

// 404 means the object is not there, which is normal: a library with no mutations
// yet has no state.json. 403 means the signature was refused, which is a different
// thing entirely — an expired share link, or a key that has been revoked — and
// reporting it as "absent" would send the caller down the wrong path.
const readResponse = async (source: string, signal?: AbortSignal) => {
    const res = await fetch(await mediaUrl(source), { signal });

    if (res.status === 403) {
        throw new AccessRejected(
            isAbsolute(source)
                ? 'This link is no longer valid. Ask for a new one.'
                : `Storage refused the signature for ${source}.${describeClockSkew(res)}`
        );
    }

    return res;
};

export const readJson = async <T>(source: string, signal?: AbortSignal): Promise<T | null> => {
    const res = await readResponse(source, signal);

    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to read ${source} (${res.status})`);
    }

    return await res.json() as T;
};

export const readBinary = async (source: string, signal?: AbortSignal): Promise<ArrayBuffer | null> => {
    const res = await readResponse(source, signal);

    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Failed to read ${source} (${res.status})`);
    }

    return await res.arrayBuffer();
};

// A signed request whose clock is far enough out is rejected as if the key were
// wrong. Storage states its own time in every response, so the real cause can be
// named instead of leaving a bare 403.
const describeClockSkew = (res: Response) => {
    const stated = res.headers.get('Date');
    if (!stated) {
        return '';
    }

    const minutes = Math.round(Math.abs(Date.now() - new Date(stated).getTime()) / 60000);
    return minutes >= 10
        ? ` This device's clock is about ${minutes} minutes off, which is enough to invalidate a signature.`
        : '';
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

export class UploadFailed extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

interface UploadOptions {
    contentType: string;
    // Aborts the upload after this long with zero bytes sent. A wall-clock timeout
    // would kill a large file on a slow connection; only a lack of progress
    // distinguishes a slow upload from a dead one.
    stallTimeoutMs: number;
}

// Sent via XHR rather than fetch because only XHR reports upload progress in every
// browser, and progress is what drives the stall detector. Without it a hung
// request holds one of the upload slots for the rest of the session.
export const uploadFile = (key: string, file: File, options: UploadOptions) =>
    new Promise<void>((resolve, reject) => {
        const config = requireStorageConfig();
        const url = objectUrl(config, key);

        // UNSIGNED-PAYLOAD keeps the file out of the signature, so signing never
        // reads it and the body streams from disk rather than through memory. This
        // is what makes many parallel uploads affordable on a phone.
        awsClient(config)
            .sign(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': options.contentType,
                    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD'
                }
            })
            .then(signed => {
                const request = new XMLHttpRequest();
                let stallTimer: ReturnType<typeof setTimeout> | undefined;
                let stalled = false;

                const restartStallTimer = () => {
                    clearTimeout(stallTimer);
                    stallTimer = setTimeout(() => {
                        stalled = true;
                        request.abort();
                    }, options.stallTimeoutMs);
                };

                request.open('PUT', url);
                signed.headers.forEach((value, name) => request.setRequestHeader(name, value));

                request.upload.onprogress = restartStallTimer;

                request.onload = () => {
                    clearTimeout(stallTimer);
                    if (request.status >= 200 && request.status < 300) {
                        resolve();
                    } else {
                        reject(new UploadFailed(request.status, `Failed to upload ${key} (${request.status})`));
                    }
                };

                request.onerror = () => {
                    clearTimeout(stallTimer);
                    reject(new UploadFailed(0, `Network error uploading ${key}`));
                };

                request.onabort = () => {
                    clearTimeout(stallTimer);
                    reject(new UploadFailed(0, stalled ? `Stalled uploading ${key}` : `Upload aborted`));
                };

                restartStallTimer();
                request.send(file);
            })
            .catch(reject);
    });

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
