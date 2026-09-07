import { describe, expect, it, vi } from 'vitest';
import { isModelCached } from '../clip';

const REPO = 'Xenova/clip-vit-base-patch32';
const base = `https://huggingface.co/${REPO}/resolve/main`;

const stubCaches = (urls: string[] | Error) => {
    vi.stubGlobal('caches', {
        open: async () => ({
            keys: async () => {
                if (urls instanceof Error) throw urls;
                return urls.map(url => ({ url }));
            }
        })
    });
};

describe('isModelCached', () => {
    it('is true once the weights are stored', async () => {
        stubCaches([`${base}/tokenizer.json`, `${base}/onnx/text_model_quantized.onnx`]);
        expect(await isModelCached(REPO)).toBe(true);
    });

    // A load abandoned part way leaves the small files behind but not the weights,
    // which still has to count as a download the next time round.
    it('is false when only the small files made it', async () => {
        stubCaches([`${base}/tokenizer.json`, `${base}/config.json`]);
        expect(await isModelCached(REPO)).toBe(false);
    });

    it('ignores weights belonging to another model', async () => {
        stubCaches(['https://huggingface.co/Xenova/other-model/resolve/main/onnx/text_model_quantized.onnx']);
        expect(await isModelCached(REPO)).toBe(false);
    });

    it('is false when the cache is unavailable or unreadable', async () => {
        vi.stubGlobal('caches', undefined);
        expect(await isModelCached(REPO)).toBe(false);

        stubCaches(new Error('blocked'));
        expect(await isModelCached(REPO)).toBe(false);
    });
});
