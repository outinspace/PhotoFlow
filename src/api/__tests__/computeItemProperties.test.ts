import { describe, expect, it } from 'vitest';
import { Item } from '../../types';
import { computeItemProperties } from '../computeItemProperties';

// A shard entry as the worker writes it, before anything is computed from it.
const shardItem = (captureTime: string | null) => ({
    itemId: 1,
    captureTime,
    files: [
        {
            fileId: 'abc',
            contentType: 'image/jpeg',
            hashSha256: 'abc',
            originalFileName: 'DSC00123.JPG',
            sizeBytes: 1000,
            uploadTimeUtc: '2026-08-05T10:00:00+00:00',
            lastProcessedTimeUtc: null,
            failedProcessingTimeUtc: null,
            tileVersion: 1,
            previewVersion: 1,
            thumbHash: null,
            previewIsOriginal: false
        }
    ]
} as unknown as Item);

describe('capture dates the catalog does not have', () => {
    it('falls back to the upload time but records that there was none', () => {
        const item = shardItem(null);

        computeItemProperties(item);

        // The fallback is what lets every consumer format and group by a date; the
        // flag is the only thing left that knows it was not a capture date.
        expect(item.hasCaptureDate).toBe(false);
        expect(item.captureTime).toBe('2026-08-05T10:00:00+00:00');
    });

    it('leaves a real capture date alone', () => {
        const item = shardItem('2026-03-18T14:22:05+00:00');

        computeItemProperties(item);

        expect(item.hasCaptureDate).toBe(true);
        expect(item.captureTime).toBe('2026-03-18T14:22:05+00:00');
    });
});
