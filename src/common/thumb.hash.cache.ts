import { useEffect, useState } from 'react';

interface DecodeResult {
    hash: string;
    dataUrl: string;
}

const cache = new Map<string, string>();
const pending = new Set<string>();
const subscribers = new Map<string, Set<(dataUrl: string) => void>>();

const worker = new Worker(new URL('./thumb.hash.worker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e: MessageEvent<DecodeResult>) => {
    const { hash, dataUrl } = e.data;
    cache.set(hash, dataUrl);
    pending.delete(hash);
    const subs = subscribers.get(hash);
    if (subs) {
        subscribers.delete(hash);
        for (const cb of subs) cb(dataUrl);
    }
};

const requestDecode = (hashes: string[]) => {
    if (hashes.length > 0) {
        worker.postMessage({ hashes });
    }
};

export const prewarmThumbHashes = (hashes: readonly (string | null)[]) => {
    const toDecode: string[] = [];
    for (const h of hashes) {
        if (!h || cache.has(h) || pending.has(h)) continue;
        pending.add(h);
        toDecode.push(h);
    }
    requestDecode(toDecode);
};

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

        if (!pending.has(hash)) {
            pending.add(hash);
            requestDecode([hash]);
        }

        return () => {
            const s = subscribers.get(hash);
            if (!s) return;
            s.delete(cb);
            if (s.size === 0) subscribers.delete(hash);
        };
    }, [hash]);

    return dataUrl;
};
