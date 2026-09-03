import { describe, expect, it, vi, afterEach } from 'vitest';
import { presignWith } from '../bucket';
import { StorageConfig } from '../config';

// The bucket is private, so every read is a presigned GET signed in the browser.
// Two properties matter and neither is visible when it breaks: the URL for one
// object has to be stable for the whole day, or the gallery re-downloads every
// tile it scrolls past, and a cache-busting version has to be inside the
// signature, or storage rejects it.

const config: StorageConfig = {
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    bucket: 'my-photos',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-west-004'
};

const params = (url: string) => new URL(url).searchParams;

afterEach(() => vi.useRealTimers());

describe('presigning a read', () => {
    it('signs for midnight, so the URL is the same all day', async () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date('2026-09-03T06:00:00Z'));
        const morning = await presignWith(config, 'catalog/manifest.json');

        vi.setSystemTime(new Date('2026-09-03T23:45:00Z'));
        const night = await presignWith(config, 'catalog/manifest.json');

        expect(params(morning).get('X-Amz-Date')).toBe('20260903T000000Z');
        expect(morning).toBe(night);
    });

    it('signs a new URL once the day rolls over', async () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date('2026-09-03T12:00:00Z'));
        const today = await presignWith(config, 'tile-image/abc.jpeg');

        vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
        const tomorrow = await presignWith(config, 'tile-image/abc.jpeg');

        expect(tomorrow).not.toBe(today);
        expect(params(tomorrow).get('X-Amz-Date')).toBe('20260904T000000Z');
    });

    it('asks for the longest expiry SigV4 allows', async () => {
        // Seven days is the cap; a link signed at midnight is therefore still good
        // for six more days, which is what a share link relies on.
        const url = await presignWith(config, 'catalog/manifest.json');

        expect(params(url).get('X-Amz-Expires')).toBe('604800');
    });

    it('keeps a cache-busting version inside the signature', async () => {
        // Appending it afterwards would invalidate the signature, because SigV4
        // covers every query parameter. A reprocessed tile keeps its key, so
        // without this the browser would go on showing the one it already had.
        const url = await presignWith(config, 'tile-image/abc.jpeg?t=2026-09-01T10:00:00Z');

        expect(params(url).get('t')).toBe('2026-09-01T10:00:00Z');
        expect(params(url).get('X-Amz-SignedHeaders')).toBe('host');
        expect(params(url).get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('signs different keys to different signatures', async () => {
        const one = await presignWith(config, 'tile-image/one.jpeg');
        const two = await presignWith(config, 'tile-image/two.jpeg');

        expect(params(one).get('X-Amz-Signature')).not.toBe(params(two).get('X-Amz-Signature'));
    });

    it('signs for the bucket in the config, not a hardcoded one', async () => {
        // One deployment serves any number of people, so nothing outside the
        // browser's own settings may name a bucket.
        const other = await presignWith({ ...config, bucket: 'someone-else' }, 'catalog/manifest.json');

        expect(other).toContain('/someone-else/catalog/manifest.json');
    });
});
