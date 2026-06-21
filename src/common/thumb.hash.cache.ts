import { useEffect, useState } from 'react';

interface DecodeResult {
    hash: string;
    dataUrl: string;
}

const cache = new Map<string, string>();
const inFlight = new Set<string>();          // sent to the worker, awaiting a result
const subscribers = new Map<string, Set<(dataUrl: string) => void>>();

const worker = new Worker(new URL('./thumb.hash.worker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e: MessageEvent<DecodeResult>) => {
    const { hash, dataUrl } = e.data;
    cache.set(hash, dataUrl);
    inFlight.delete(hash);
    const subs = subscribers.get(hash);
    if (subs) {
        subscribers.delete(hash);
        for (const cb of subs) cb(dataUrl);
    }
};

const requestDecode = (hash: string) => {
    if (cache.has(hash) || inFlight.has(hash)) return;
    inFlight.add(hash);
    worker.postMessage({ hashes: [hash] });
};

// Decodes a thumbhash lazily, on mount, and caches the result so scrolling back
// is instant. No eager prewarming — only what's mounted (visible + overscan) is decoded.
export const useThumbHashDataUrl = (hash: string | null): string | null => {
    const [dataUrl, setDataUrl] = useState<string | null>(
        () => (hash ? cache.get(hash) ?? null : null)
    );

    useEffect(() => {
        if (!hash) {
            setDataUrl(null);
            return;
        }

        const cached = cache.get(hash);
        if (cached) {
            setDataUrl(cached);
            return;
        }

        setDataUrl(null);

        const cb = (url: string) => setDataUrl(url);
        let subs = subscribers.get(hash);
        if (!subs) {
            subs = new Set();
            subscribers.set(hash, subs);
        }
        subs.add(cb);

        requestDecode(hash);

        return () => {
            const s = subscribers.get(hash);
            if (!s) return;
            s.delete(cb);
            if (s.size === 0) subscribers.delete(hash);
        };
    }, [hash]);

    return dataUrl;
};
