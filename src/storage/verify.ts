// Working out *why* a connection failed.
//
// A browser deliberately tells JavaScript almost nothing about a blocked
// cross-origin request: a CORS rejection and an unreachable host both surface as
// the same opaque TypeError. So instead of reporting "failed to fetch", this runs
// a short ladder of requests, each of which fails for exactly one reason, and
// reports the first rung that breaks.

import { canSignRequests, listResponse } from './bucket';
import { resolvePublicBaseUrl, StorageConfig } from './config';
import * as keys from './keys';

export type VerifyFailure =
    | 'insecure-context'
    | 'unreachable'
    | 'cors-reads'
    | 'cors-signed'
    | 'bad-credentials'
    | 'no-such-bucket'
    | 'no-list-permission'
    | 'unknown';

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

    const probeUrl = resolvePublicBaseUrl(config) + keys.CATALOG_MANIFEST;

    // Rung 1: is anything there at all? A no-cors request is not blocked by CORS,
    // so it fails only when the host genuinely cannot be reached.
    try {
        await fetch(probeUrl, { mode: 'no-cors', cache: 'no-store' });
    } catch {
        return { ok: false, failure: 'unreachable', detail: config.endpoint };
    }

    // Rung 2: can the app read? A plain GET sends no custom headers, so it is not
    // preflighted — it fails only if no CORS rule permits reads from this origin.
    try {
        await fetch(probeUrl, { cache: 'no-store' });
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

    if (res.ok) {
        return { ok: true };
    }

    return classifyHttpFailure(res);
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
