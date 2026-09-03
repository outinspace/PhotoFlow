import { describe, expect, it } from 'vitest';
import * as keys from '../keys';
import {
    generatePrivatePrefix,
    normalizeConfig,
    resolveKey,
    resolvePrivatePrefix,
    stripPrivatePrefix,
    StorageConfig
} from '../config';

const config = (privatePrefix?: string): StorageConfig => ({
    endpoint: 'https://s3.example.invalid',
    bucket: 'photos',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    privatePrefix
});

describe('what moves under the private prefix', () => {
    // These are the keys the whole scheme exists to hide. A regression here is
    // silent: the app keeps working and the catalog is readable by anyone.
    it.each([
        keys.CATALOG_MANIFEST,
        keys.shard('2026-08'),
        keys.shard('2026-08', 3),
        keys.embeddings('2026-08'),
        keys.META_STATE,
        keys.META_HEARTBEAT,
        keys.deviceLog('phone'),
        keys.reprocessRequest('abc'),
        keys.INCOMING
    ])('%s is prefixed', key => {
        expect(resolveKey(config('s3cret'), key)).toBe(`s3cret/${key}`);
    });

    // And these must not move: media is named by content hash and a share document
    // by the secret in its link, so both are already unguessable and are read
    // straight from the CDN. Prefixing them would break every image in the app.
    it.each([
        'original/abc123',
        'tile-image/abc123.jpeg',
        'preview/abc123.mp4',
        'share/album/somesecret.json',
        'share/item/abc123.json'
    ])('%s stays where it is', key => {
        expect(resolveKey(config('s3cret'), key)).toBe(key);
    });
});

describe('resolution', () => {
    it('changes nothing when no prefix is set', () => {
        expect(resolveKey(config(), keys.CATALOG_MANIFEST)).toBe(keys.CATALOG_MANIFEST);
        expect(resolveKey(null, keys.CATALOG_MANIFEST)).toBe(keys.CATALOG_MANIFEST);
    });

    it('round trips, so a listed key can be read back', () => {
        const listed = resolveKey(config('s3cret'), keys.deviceLog('phone'));
        expect(stripPrivatePrefix(config('s3cret'), listed)).toBe(keys.deviceLog('phone'));
    });

    it('does not prefix a key twice', () => {
        const once = resolveKey(config('s3cret'), keys.CATALOG_MANIFEST);
        const logical = stripPrivatePrefix(config('s3cret'), once);
        expect(resolveKey(config('s3cret'), logical)).toBe(once);
    });

    it('tolerates slashes around the configured value', () => {
        expect(resolvePrivatePrefix(config('/s3cret/'))).toBe('s3cret/');
        expect(normalizeConfig(config('/s3cret/')).privatePrefix).toBe('s3cret');
    });

    it('treats an empty prefix as absent rather than as a root folder', () => {
        expect(normalizeConfig(config('   ')).privatePrefix).toBeUndefined();
        expect(resolvePrivatePrefix(config(''))).toBe('');
    });
});

describe('the generated prefix', () => {
    it('is long enough not to be guessable, and different every time', () => {
        const first = generatePrivatePrefix();
        expect(first).toMatch(/^[0-9a-z]{32}$/);
        expect(new Set(Array.from({ length: 50 }, generatePrivatePrefix)).size).toBe(50);
    });
});
