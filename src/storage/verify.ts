// Working out *why* a connection failed.
//
// A browser deliberately tells JavaScript almost nothing about a blocked
// cross-origin request: a CORS rejection and an unreachable host both surface as
// the same opaque TypeError. So instead of reporting "failed to fetch", this runs
// a short ladder of requests, each of which fails for exactly one reason, and
// reports the first rung that breaks.

import { canSignRequests, listResponse, presignMediaWith, presignWith, signedRequestWith, unsignedObjectUrl } from './bucket';
import { StorageConfig } from './config';
import * as keys from './keys';

export type VerifyFailure =
    | 'insecure-context'
    | 'unreachable'
    | 'cors-reads'
    | 'cors-signed'
    | 'bad-credentials'
    | 'no-such-bucket'
    | 'no-list-permission'
    | 'no-write-permission'
    | 'bucket-is-public'
    | 'cdn-rejects-signatures'
    | 'cdn-unreachable'
    | 'unknown';

// Written, read back without a signature, and removed again, to establish whether
// the bucket serves anonymous readers. Deliberately outside every prefix anything
// lists — meta/log/ and meta/reprocess/ are both scanned, and a stray file in
// either would be read as a device log or a rebuild request.
const ACCESS_PROBE_KEY = 'meta/.access-check';

// A key that cannot exist, used to ask a CDN whether it forwards a signed request
// intact. Storage answers a valid signature for a missing object with 404 and an
// invalid one with 403, so the two cases are told apart without needing a photo to
// already be there.
const MISSING_MEDIA_KEY = `tile-image/${'0'.repeat(64)}.jpeg`;

export interface VerifyResult {
    ok: boolean;
    failure?: VerifyFailure;
    detail?: string;
    // Set when the provider told us which region it expected, so the caller can
    // save the corrected value rather than making the user find it.
    correctedRegion?: string;
}

export const verifyConnection = async (config: StorageConfig): Promise<VerifyResult> => {
    if (!canSignRequests()) {
        return { ok: false, failure: 'insecure-context' };
    }

    // Rung 1: is anything there at all? A no-cors request is never blocked by CORS,
    // so it fails only when the host genuinely cannot be reached — whatever status
    // comes back counts as reachable.
    //
    // Signed even though the status is ignored. An unsigned request to a private
    // bucket is answered 403, and the browser logs that as a failed resource load,
    // which reads as a broken connection in the console when nothing is wrong.
    let probeUrl: string;
    try {
        probeUrl = await presignWith(config, keys.CATALOG_MANIFEST);
    } catch {
        // A config too malformed to sign is one whose endpoint cannot be reached.
        return { ok: false, failure: 'unreachable', detail: config.endpoint };
    }

    try {
        await fetch(probeUrl, { mode: 'no-cors', cache: 'no-store' });
    } catch {
        return { ok: false, failure: 'unreachable', detail: config.endpoint };
    }

    // Rung 2: can the app read? The bucket is private, so this has to be a signed
    // GET — but the signature rides in the query string, which sends no custom
    // headers and so is not preflighted. It therefore still fails for exactly one
    // reason: no CORS rule permits reads from this origin.
    try {
        await fetch(await presignWith(config, keys.CATALOG_MANIFEST), { cache: 'no-store' });
    } catch {
        return { ok: false, failure: 'cors-reads' };
    }

    // Rung 3: can the app write? Signed requests carry Authorization and x-amz-*
    // headers, which forces a preflight that read-only CORS rules reject.
    let res: Response;
    try {
        res = await listResponse(keys.META_LOGS, config);
    } catch {
        return { ok: false, failure: 'cors-signed' };
    }

    if (!res.ok) {
        return classifyHttpFailure(res);
    }

    // Rung 4: is the bucket actually private? Everything above works just as well
    // on a public bucket, and on one the whole security model is gone: the catalog
    // sits at fixed paths and would hand its shards — with the coordinates, camera
    // and filename of every photo — to anyone who found the bucket.
    const privacy = await checkBucketRefusesAnonymousReads(config);
    if (!privacy.ok) {
        return privacy;
    }

    // Rung 5: if pictures are read through a CDN, does a signed request survive the
    // trip? Nothing above touches it, so a CDN that rewrites the host or the path
    // would leave a working app in which no image ever loads.
    return checkMediaHostForwardsSignatures(config);
};

/**
 * Whether the configured picture host passes a signed request through unchanged.
 *
 * SigV4 covers the Host header and the path, so a CDN that rewrites either makes
 * storage compute a different signature and refuse. Asking for an object that
 * cannot exist separates the two: 404 means the signature verified and only the
 * object was missing, 403 means it did not.
 */
const checkMediaHostForwardsSignatures = async (config: StorageConfig): Promise<VerifyResult> => {
    if (!config.publicBaseUrl) {
        return { ok: true };
    }

    let res: Response;
    try {
        res = await fetch(await presignMediaWith(config, MISSING_MEDIA_KEY), { cache: 'no-store' });
    } catch {
        // Unreachable, or answering without CORS headers. Either way the browser
        // cannot read pictures from it.
        return { ok: false, failure: 'cdn-unreachable', detail: config.publicBaseUrl };
    }

    if (res.status === 403) {
        return { ok: false, failure: 'cdn-rejects-signatures', detail: config.publicBaseUrl };
    }

    return { ok: true };
};

/**
 * Whether the bucket refuses a reader with no credentials.
 *
 * This writes a one-byte object, reads it back unsigned, and deletes it. Probing
 * an object that is known to exist is what makes the answer definitive, and it is
 * why this cannot just read the manifest: on a bucket with no photos yet there is
 * nothing to read, and "not found" and "not allowed" are the two things being told
 * apart.
 *
 * Providers disagree about what an anonymous refusal looks like from a browser. B2
 * answers 401 with no CORS headers at all, so the fetch throws and the status is
 * unreadable; MinIO answers 403 with them. They agree on the case that matters: a
 * public bucket serves an existing object to an anonymous reader, and does so with
 * CORS headers, which is a result this can read. So a readable success means public,
 * and anything else means the read was refused.
 */
const checkBucketRefusesAnonymousReads = async (config: StorageConfig): Promise<VerifyResult> => {
    let written: Response;
    try {
        written = await signedRequestWith(config, ACCESS_PROBE_KEY, {
            method: 'PUT',
            body: 'x',
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch {
        return { ok: false, failure: 'cors-signed' };
    }

    if (!written.ok) {
        // Listing worked, so the key reaches the bucket; it just cannot write.
        return { ok: false, failure: 'no-write-permission', detail: `HTTP ${written.status}` };
    }

    try {
        const anonymous = await fetch(unsignedObjectUrl(config, ACCESS_PROBE_KEY), { cache: 'no-store' });

        // Anything the bucket answered other than a refusal means it served an
        // object to a request carrying no credentials.
        if (anonymous.status !== 401 && anonymous.status !== 403) {
            return { ok: false, failure: 'bucket-is-public', detail: `HTTP ${anonymous.status}` };
        }
    } catch {
        // The refusal carried no CORS headers, which is how B2 refuses. Reads from
        // this origin are known to work by now — rung 2 proved it — so this is the
        // bucket saying no, not a CORS rule.
    } finally {
        // Best effort: a probe left behind is one stray byte under meta/, which
        // nothing lists and nothing reads.
        await signedRequestWith(config, ACCESS_PROBE_KEY, { method: 'DELETE' }).catch(() => undefined);
    }

    return { ok: true };
};

const classifyHttpFailure = async (res: Response): Promise<VerifyResult> => {
    const body = await res.text().catch(() => '');
    const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? '';

    // Some providers reject a wrong region but name the right one, so this is
    // recoverable without asking the user for anything.
    if (code === 'AuthorizationHeaderMalformed') {
        const expected = body.match(/<Region>([^<]+)<\/Region>/)?.[1]
            ?? body.match(/expecting '([a-z0-9-]+)'/)?.[1];

        if (expected) {
            return { ok: false, failure: 'unknown', correctedRegion: expected };
        }
    }

    if (res.status === 404 || code === 'NoSuchBucket') {
        return { ok: false, failure: 'no-such-bucket' };
    }

    if (code === 'SignatureDoesNotMatch' || code === 'InvalidAccessKeyId') {
        return { ok: false, failure: 'bad-credentials', detail: code };
    }

    if (res.status === 403) {
        // The key reached the bucket but may not be allowed to list it, which the
        // app needs in order to find other devices' mutation logs.
        return { ok: false, failure: 'no-list-permission', detail: code };
    }

    return { ok: false, failure: 'unknown', detail: `${res.status} ${code}`.trim() };
};

export const CORS_RULE_EXAMPLE = `[{
  "AllowedOrigins": ["${typeof window === 'undefined' ? '*' : window.location.origin}"],
  "AllowedMethods": ["GET", "HEAD", "PUT"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]`;
