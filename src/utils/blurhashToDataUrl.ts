import { decode } from 'blurhash';

const DECODE_WIDTH = 32;
const DECODE_HEIGHT = 32;

/**
 * Decodes a blur hash string to a data URL suitable for use as background-image.
 * Returns null if decoding fails or blurHash is falsy.
 */
export function blurhashToDataUrl(blurHash: string | null | undefined): string | null {
    if (!blurHash || typeof blurHash !== 'string') {
        return null;
    }
    try {
        const pixels = decode(blurHash, DECODE_WIDTH, DECODE_HEIGHT);
        const canvas = document.createElement('canvas');
        canvas.width = DECODE_WIDTH;
        canvas.height = DECODE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const imageData = ctx.createImageData(DECODE_WIDTH, DECODE_HEIGHT);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
        return null;
    }
}
