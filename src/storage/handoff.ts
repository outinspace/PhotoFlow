import { StorageConfig } from './config';

// Moving a connection from one device to another.
//
// The payload is the bucket credentials, so two choices here are deliberate.
// It travels in the URL *fragment*, which browsers never send to a server, so it
// cannot end up in an access log or a CDN cache. And the receiving device strips
// it from the address bar immediately, so it does not linger in history.
//
// None of that makes the QR code itself safe: anyone who photographs the screen
// while it is displayed has the key. That is why the page hides it by default and
// takes it away again on a timer.

const FRAGMENT_KEY = 'c';

const toBase64Url = (value: string) =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string) => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded.padEnd(padded.length + ((4 - padded.length % 4) % 4), '='));
};

export const encodeHandoff = (config: StorageConfig): string => {
    // Encoded positionally rather than as an object: the field names would roughly
    // double a payload that has to fit in a scannable QR code.
    const compact = [
        config.endpoint,
        config.bucket,
        config.accessKeyId,
        config.secretAccessKey,
        config.region ?? '',
        config.publicBaseUrl ?? ''
    ];

    return toBase64Url(JSON.stringify(compact));
};

export const decodeHandoff = (encoded: string): StorageConfig | null => {
    try {
        const compact = JSON.parse(fromBase64Url(encoded));
        if (!Array.isArray(compact) || compact.length < 4) {
            return null;
        }

        const [endpoint, bucket, accessKeyId, secretAccessKey, region, publicBaseUrl] = compact;
        if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
            return null;
        }

        return {
            endpoint,
            bucket,
            accessKeyId,
            secretAccessKey,
            region: region || undefined,
            publicBaseUrl: publicBaseUrl || undefined
        };
    } catch {
        return null;
    }
};

export const buildHandoffUrl = (config: StorageConfig) =>
    `${window.location.origin}/connect#${FRAGMENT_KEY}=${encodeHandoff(config)}`;

// A handoff read from a scanned code rather than from this page's own URL. On a
// phone with the app installed, scanning with the camera opens the browser
// instead, and the credentials would be saved to the wrong place — so the app
// scans the code itself.
export const decodeHandoffUrl = (scanned: string): StorageConfig | null => {
    const fragment = scanned.split('#')[1];
    if (!fragment) {
        return null;
    }

    const encoded = new URLSearchParams(fragment).get(FRAGMENT_KEY);
    return encoded ? decodeHandoff(encoded) : null;
};

// Reads a handoff out of the current URL and removes it in the same step, so the
// credentials cannot be recovered from the address bar or the back button.
//
// Memoised because that read is destructive and callers are not guaranteed to run
// once: React mounts a component twice in development, and the second mount — the
// one that survives — would otherwise find the fragment already gone and conclude
// there was no handoff at all.
let taken: StorageConfig | null | undefined;

export const takeHandoffFromUrl = (): StorageConfig | null => {
    if (taken !== undefined) {
        return taken;
    }

    taken = readAndStrip();
    return taken;
};

const readAndStrip = (): StorageConfig | null => {
    const fragment = window.location.hash.replace(/^#/, '');
    if (!fragment) {
        return null;
    }

    const encoded = new URLSearchParams(fragment).get(FRAGMENT_KEY);
    if (!encoded) {
        return null;
    }

    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    return decodeHandoff(encoded);
};
