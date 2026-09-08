import { describe, expect, it } from 'vitest';
import { containedSize, focalOffset, panLimit } from '../use.preview.gestures';

const PHONE = { width: 390, height: 844 };

// Where a screen point sits on the photo, given the transform showing it.
const contentPoint = (screen: number, offset: number, scale: number) => (screen - offset) / scale;
// And back again.
const screenPoint = (content: number, offset: number, scale: number) => content * scale + offset;

describe('the photo inside the viewport', () => {
    it('letterboxes a photo whose shape is not the screen\'s', () => {
        // 4:3 landscape on a tall phone: full width, and nowhere near the full height.
        expect(containedSize(PHONE, { width: 4032, height: 3024 })).toEqual({ width: 390, height: 292.5 });
    });

    it('falls back to the whole viewport when the catalog has no dimensions', () => {
        expect(containedSize(PHONE, { width: null, height: null })).toEqual(PHONE);
    });
});

describe('how far a zoomed photo may be moved', () => {
    it('stays centred on an axis it does not fill', () => {
        // That same landscape photo is 292.5 tall; at 2x it is 585, still short of 844.
        expect(panLimit(PHONE.height, 292.5, 2)).toBe(0);
    });

    it('may be moved by half of whatever overflows', () => {
        expect(panLimit(PHONE.width, 390, 2)).toBe(195);
        expect(panLimit(PHONE.height, 292.5, 4)).toBe(163);
    });
});

describe('zooming about the fingers', () => {
    it('leaves the part of the photo under them where it was', () => {
        // A finger 100px right of centre, pinching from rest out to 3x.
        const before = contentPoint(100, 0, 1);
        const offset = focalOffset(0, 100, 100, 1, 3);

        expect(screenPoint(before, offset, 3)).toBeCloseTo(100);
    });

    it('carries that part of the photo along when the fingers drift', () => {
        // Already at 2x and panned, the fingers move from 100 to -40 while zooming to 2.5x.
        const before = contentPoint(100, 30, 2);
        const offset = focalOffset(30, 100, -40, 2, 2.5);

        expect(screenPoint(before, offset, 2.5)).toBeCloseTo(-40);
    });

    it('is a no-op when neither the scale nor the fingers move', () => {
        expect(focalOffset(30, 100, 100, 2, 2)).toBe(30);
    });
});
