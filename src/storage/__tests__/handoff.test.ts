import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeHandoff, decodeHandoffUrl, encodeHandoff } from '../handoff';
import { StorageConfig } from '../config';

const full: StorageConfig = {
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    bucket: 'my-photos',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-west-004',
    publicBaseUrl: 'https://photos.example.com/'
};

const minimal: StorageConfig = {
    endpoint: 'https://s3.example.com',
    bucket: 'b',
    accessKeyId: 'k',
    secretAccessKey: 's'
};

describe('handing a connection to another device', () => {
    it('round-trips every field', () => {
        expect(decodeHandoff(encodeHandoff(full))).toEqual(full);
    });

    it('round-trips when the optional fields are absent', () => {
        // Empty strings must come back as undefined, or they would win over the
        // values normally derived from the endpoint.
        const decoded = decodeHandoff(encodeHandoff(minimal));

        expect(decoded).toEqual(minimal);
        expect(decoded?.region).toBeUndefined();
        expect(decoded?.publicBaseUrl).toBeUndefined();
    });

    it('survives secrets containing characters that are unsafe in a URL', () => {
        const awkward = { ...minimal, secretAccessKey: 'a+b/c=d&e?f#g yz' };

        expect(decodeHandoff(encodeHandoff(awkward))?.secretAccessKey).toBe('a+b/c=d&e?f#g yz');
    });

    it('produces a payload with no characters that need escaping in a fragment', () => {
        expect(encodeHandoff(full)).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('rejects a malformed payload rather than half-applying it', () => {
        expect(decodeHandoff('not-base64!!')).toBeNull();
        expect(decodeHandoff(btoa('{"a":1}'))).toBeNull();
        expect(decodeHandoff(btoa('["https://s3.example.com","bucket"]'))).toBeNull();
    });

    it('rejects a payload missing the secret', () => {
        expect(decodeHandoff(btoa(JSON.stringify(['https://s3.example.com', 'b', 'k', ''])))).toBeNull();
    });
});

describe('taking the handoff out of the URL', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('removes the credentials from the address bar as it reads them', async () => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            history: { replaceState },
            location: { hash: `#c=${encodeHandoff(minimal)}`, pathname: '/connect', search: '' }
        });

        const { takeHandoffFromUrl } = await import('../handoff');
        const config = takeHandoffFromUrl();

        expect(config?.bucket).toBe('b');
        // Leaving it in place would put the key in history and the back button.
        expect(replaceState).toHaveBeenCalledWith(null, '', '/connect');
    });

    it('returns the same handoff when read more than once', async () => {
        // React mounts components twice in development. A read that consumed the
        // fragment on the first mount would leave the surviving mount with nothing,
        // which is exactly how this failed the first time.
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            history: { replaceState },
            location: { hash: `#c=${encodeHandoff(minimal)}`, pathname: '/connect', search: '' }
        });

        const { takeHandoffFromUrl } = await import('../handoff');

        const first = takeHandoffFromUrl();
        // Mimic the fragment having been stripped by the first call.
        (globalThis as any).window.location.hash = '';
        const second = takeHandoffFromUrl();

        expect(first).not.toBeNull();
        expect(second).toEqual(first);
        expect(replaceState).toHaveBeenCalledTimes(1);
    });

    it('returns null when there is no handoff', async () => {
        vi.stubGlobal('window', {
            history: { replaceState: vi.fn() },
            location: { hash: '', pathname: '/connect', search: '' }
        });

        const { takeHandoffFromUrl } = await import('../handoff');

        expect(takeHandoffFromUrl()).toBeNull();
    });
});

describe('decoding a scanned code', () => {
    it('reads a handoff out of a full scanned URL', () => {
        const url = `https://photoflow.outin.space/connect#c=${encodeHandoff(minimal)}`;

        expect(decodeHandoffUrl(url)).toEqual(minimal);
    });

    it('ignores a QR code that is not a connection code', () => {
        // Any other code could be in frame; treating it as a handoff would try to
        // connect to nothing.
        expect(decodeHandoffUrl('https://example.com')).toBeNull();
        expect(decodeHandoffUrl('WIFI:S=coffeeshop;T=WPA;P=hunter2;;')).toBeNull();
        expect(decodeHandoffUrl('https://photoflow.outin.space/connect#c=garbage')).toBeNull();
    });

    it('does not care what host the code was built for', () => {
        // The code is generated on whatever origin the other device is using.
        const url = `http://localhost:5199/connect#c=${encodeHandoff(full)}`;

        expect(decodeHandoffUrl(url)).toEqual(full);
    });
});

describe('the private prefix in a handoff', () => {
    const config = {
        endpoint: 'https://s3.example.invalid',
        bucket: 'photos',
        accessKeyId: 'id',
        secretAccessKey: 'secret',
        privatePrefix: 'abc123'
    };

    it('travels with the credentials, or the new device reads the wrong paths', () => {
        expect(decodeHandoff(encodeHandoff(config))?.privatePrefix).toBe('abc123');
    });

    it('is absent from a code made before the catalog moved, without failing', () => {
        // A five-field code is what an older build produced. It has to still work.
        const older = btoa(JSON.stringify([
            config.endpoint, config.bucket, config.accessKeyId, config.secretAccessKey, ''
        ])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const decoded = decodeHandoff(older);
        expect(decoded?.bucket).toBe('photos');
        expect(decoded?.privatePrefix).toBeUndefined();
    });
});
