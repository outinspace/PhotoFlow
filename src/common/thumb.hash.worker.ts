/// <reference lib="webworker" />
import { thumbHashToDataURL } from 'thumbhash';

interface DecodeRequest {
    hashes: string[];
}

interface DecodeResult {
    hash: string;
    dataUrl: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<DecodeRequest>) => {
    for (const hash of e.data.hashes) {
        const binary = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
        const dataUrl = thumbHashToDataURL(binary);
        const result: DecodeResult = { hash, dataUrl };
        ctx.postMessage(result);
    }
};
