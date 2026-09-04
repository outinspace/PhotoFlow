import { AwsClient } from 'aws4fetch';
import { bucketBaseUrl, getStorageConfig, requireStorageConfig, resolveMediaBaseUrl, resolveRegion, StorageConfig, virtualHostBaseUrl } from './config';

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
const urlUnder = (base: string, key: string) => {
    const [path, query] = key.split('?');
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return `${base}${encoded}${query ? `?${query}` : ''}`;
};

// Data — the catalog, the mutation logs — and every write always go to the bucket
// endpoint. Only pictures may go somewhere else; see mediaBaseFor.
const objectUrl = (config: StorageConfig, key: string) => urlUnder(bucketBaseUrl(config), key);

/**
 * A key that cannot exist, used to ask a host whether it accepts a signature.
 *
 * Storage answers a valid signature for a missing object with 404 and an invalid
 * one with 403, so the two are told apart without needing a picture to be there.
 */
export const MISSING_MEDIA_KEY = `tile-image/${'0'.repeat(64)}.jpeg`;

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

// The base is part of the key: pointing at a CDN changes the host the signature
// covers, so a URL signed for the bucket is not valid for the CDN and vice versa.
const signatureCacheKey = (base: string, config: StorageConfig, key: string, stamp: string) =>
    `${stamp}|${base}|${config.accessKeyId}|${key}`;

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

    return signedUrls.get(
        signatureCacheKey(mediaBaseFor(config, source), config, source, signingStamp())
    ) ?? null;
};

/**
 * A presigned GET URL, signed with a config passed in rather than the stored one.
 *
 * The setup screen needs this: it has to prove a connection works before it saves
 * anything, so at that point there is no stored config to sign with.
 */
export const presignWith = (config: StorageConfig, key: string): Promise<string> =>
    presignUnder(bucketBaseUrl(config), config, key);

/**
 * The same, but under whichever host pictures are read from — a CDN when one is
 * configured. Exported so the connect screen can prove that host works before it
 * is saved and every thumbnail starts depending on it.
 */
export const presignMediaWith = (config: StorageConfig, key: string): Promise<string> =>
    presignUnder(mediaBaseFor(config, key), config, key);

// Whether pictures may be split across the bucket's second hostname. Decided once
// per session, and remembered per bucket between sessions.
//
// Once per session because it must not change while the app is running: a picture
// signed for one host and later re-signed for the other is a second download and a
// second entry in the service worker's cache for the same image. So the first load
// after connecting reads from one host, and every load after that from both.
//
// Only a positive answer is stored. A negative one may have been a network failure
// rather than a host that cannot serve this form, and one probe per load is a lower
// price than never using the second host again.
const SECOND_HOST_KEY = 'photoflow.secondHost';

let secondHostDecidedFor = '';
let secondHostAllowed = false;

const mayUseSecondHost = (config: StorageConfig, alternate: string) => {
    const bucket = bucketBaseUrl(config);
    if (secondHostDecidedFor === bucket) {
        return secondHostAllowed;
    }

    secondHostDecidedFor = bucket;
    secondHostAllowed = storedSecondHostFlag(bucket);

    // Guarded on window rather than on fetch, so this stays out of tests and any
    // other non-browser caller: it is an optimisation, and it costs a request.
    if (!secondHostAllowed && typeof window !== 'undefined') {
        void probeSecondHost(bucket, config, alternate);
    }

    return secondHostAllowed;
};

const storedSecondHostFlag = (bucket: string) => {
    try {
        return localStorage.getItem(`${SECOND_HOST_KEY}.${bucket}`) === 'true';
    } catch {
        return false;
    }
};

const probeSecondHost = async (bucket: string, config: StorageConfig, alternate: string) => {
    try {
        const res = await fetch(await presignUnder(alternate, config, MISSING_MEDIA_KEY), { cache: 'no-store' });

        // 403 is the host refusing the signature, which is what a provider that
        // does not serve this form looks like. Anything else means it does.
        if (res.status !== 403) {
            localStorage.setItem(`${SECOND_HOST_KEY}.${bucket}`, 'true');
        }
    } catch {
        // Unreachable, or answering without the CORS header the browser needs.
        // Either way the second host is no use here.
    }
};

// Deterministic, so one picture always has one URL. Choosing at random would give
// the service worker two cache entries for every tile and download each twice.
const splitsToSecondHost = (key: string) => {
    let sum = 0;
    for (let index = 0; index < key.length; index++) {
        sum += key.charCodeAt(index);
    }
    return sum % 2 === 1;
};

/**
 * Which host a picture is read from.
 *
 * A CDN, when configured, is a single host and is used exactly as given. Otherwise
 * pictures are split across the bucket's own two addresses — see
 * virtualHostBaseUrl for why that is worth doing.
 */
const mediaBaseFor = (config: StorageConfig, key: string) => {
    if (config.publicBaseUrl) {
        return resolveMediaBaseUrl(config);
    }

    const alternate = virtualHostBaseUrl(config);
    if (alternate && mayUseSecondHost(config, alternate) && splitsToSecondHost(key)) {
        return alternate;
    }

    return bucketBaseUrl(config);
};

const presignUnder = async (base: string, config: StorageConfig, key: string): Promise<string> => {
    // An empty key is the bucket root, and a signed GET of the bucket root is a
    // ListObjects request: a URL that lists every object, valid for a week, handed
    // to whoever asked for a picture. Nothing may ever sign one by accident.
    if (!key.split('?')[0]) {
        throw new Error('Refusing to sign a URL for the bucket itself rather than an object in it.');
    }

    const stamp = signingStamp();
    const cacheKey = signatureCacheKey(base, config, key, stamp);

    const cached = signedUrls.get(cacheKey);
    if (cached) {
        return cached;
    }

    const url = new URL(urlUnder(base, key));
    url.searchParams.set('X-Amz-Expires', String(SIGNED_READ_TTL_SECONDS));

    const signed = await awsClient(config).sign(url.toString(), {
        method: 'GET',
        aws: { signQuery: true, datetime: stamp }
    });

    signedUrls.set(cacheKey, signed.url);
    return signed.url;
};

/** A URL the browser can load for a picture, signing it if necessary. */
export const mediaUrl = async (source: string): Promise<string> =>
    isAbsolute(source) ? source : presignMediaWith(requireStorageConfig(), source);

// RFC 6266: a plain `filename` every client understands, holding an ASCII-safe
// version, and a `filename*` carrying the real name in UTF-8. Both B2 and MinIO
// echo whatever is asked for here verbatim, so the browser does the parsing.
const attachmentDisposition = (fileName: string) => {
    const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const utf8 = encodeURIComponent(fileName)
        .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
};

/**
 * A URL that downloads an object under its original filename.
 *
 * The `download` attribute on a link is ignored for a cross-origin URL, and every
 * picture here is cross-origin, so the only way to make a browser save rather than
 * display is for storage itself to say so. S3 lets a presigned GET override the
 * Content-Disposition it will answer with — and because that override is a query
 * parameter, it is covered by the signature and cannot be stripped or altered.
 *
 * A source that is already an absolute URL came from a share document and was
 * signed this way when the document was written.
 */
export const downloadUrl = async (source: string, fileName: string): Promise<string> => {
    if (isAbsolute(source)) {
        return source;
    }

    const query = new URLSearchParams({ 'response-content-disposition': attachmentDisposition(fileName) });
    return presignMediaWith(requireStorageConfig(), `${source}?${query}`);
};

/** Thrown when storage refused a signature, rather than merely lacking the object. */
export class AccessRejected extends Error {}

// 404 means the object is not there, which is normal: a library with no mutations
// yet has no state.json. 403 means the signature was refused, which is a different
// thing entirely — an expired share link, or a key that has been revoked — and
// reporting it as "absent" would send the caller down the wrong path.
// Data, not pictures: always the bucket endpoint, never the CDN. A share document
// is the exception — it arrives as an absolute URL that was signed elsewhere.
const dataUrl = (source: string) =>
    isAbsolute(source) ? Promise.resolve(source) : presignWith(requireStorageConfig(), source);

const readResponse = async (source: string, signal?: AbortSignal) => {
    const res = await fetch(await dataUrl(source), { signal });

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

/**
 * The address of an object with no signature on it.
 *
 * Its only legitimate use is proving that the bucket refuses anonymous reads —
 * see verify.ts. Anything that actually needs to read an object must sign for it.
 */
export const unsignedObjectUrl = (config: StorageConfig, key: string) => objectUrl(config, key);

/** A signed request against a config passed in, for the setup screen's checks. */
export const signedRequestWith = (
    config: StorageConfig,
    key: string,
    init: RequestInit
) => awsClient(config).fetch(objectUrl(config, key), init);

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
