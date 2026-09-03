import { describe, expect, it } from 'vitest';
import { StorageConfig, deriveRegion, normalizeConfig, resolveMediaBaseUrl, resolveRegion } from '../config';

const base: StorageConfig = {
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    bucket: 'my-photos',
    accessKeyId: 'key',
    secretAccessKey: 'secret'
};

describe('deriving the region from the endpoint', () => {
    it.each([
        ['https://s3.us-west-004.backblazeb2.com', 'us-west-004'],
        ['https://s3.eu-central-003.backblazeb2.com', 'eu-central-003'],
        ['https://s3.us-east-1.amazonaws.com', 'us-east-1'],
        ['https://s3.eu-west-2.amazonaws.com', 'eu-west-2'],
        ['https://s3-ap-southeast-2.amazonaws.com', 'ap-southeast-2'],
        ['https://s3.eu-central-1.wasabisys.com', 'eu-central-1'],
        ['https://nyc3.digitaloceanspaces.com', 'us-east-1'],
        ['https://abc123.r2.cloudflarestorage.com', 'auto'],
    ])('%s -> %s', (endpoint, expected) => {
        expect(deriveRegion(endpoint)).toBe(expected);
    });

    it('falls back rather than throwing on nonsense', () => {
        expect(deriveRegion('not a url')).toBe('us-east-1');
    });

    it('prefers an explicitly stored region over the derived one', () => {
        // Set only when a provider told us the derived guess was wrong.
        expect(resolveRegion({ ...base, region: 'us-west-2' })).toBe('us-west-2');
    });

    it('uses the derived region when none is stored', () => {
        expect(resolveRegion(base)).toBe('us-west-004');
    });
});

describe('where pictures are read from', () => {
    it('falls back to the bucket when no CDN is given', () => {
        expect(resolveMediaBaseUrl(base)).toBe('https://s3.us-west-004.backblazeb2.com/my-photos/');
    });

    it('uses the CDN when one is given', () => {
        expect(resolveMediaBaseUrl({ ...base, publicBaseUrl: 'https://photos.example.com' }))
            .toBe('https://photos.example.com/');
    });

    it('always ends in a single slash, so key concatenation is safe', () => {
        expect(resolveMediaBaseUrl({ ...base, publicBaseUrl: 'https://photos.example.com///' }))
            .toBe('https://photos.example.com/');
    });

    it('treats a blank picture URL as absent rather than empty', () => {
        expect(normalizeConfig({ ...base, publicBaseUrl: '   ' }).publicBaseUrl).toBeUndefined();
    });
});

describe('normalising what was typed', () => {
    it('trims whitespace and trailing slashes from the endpoint', () => {
        expect(normalizeConfig({ ...base, endpoint: '  https://s3.example.com//  ' }).endpoint)
            .toBe('https://s3.example.com');
    });

    it('treats a blank optional field as absent rather than empty', () => {
        // An empty string would otherwise win over the value derived from the endpoint.
        expect(normalizeConfig({ ...base, region: '  ' }).region).toBeUndefined();
    });
});
