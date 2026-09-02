// Semantic search, entirely in the browser.
//
// The expensive half — encoding every photo — already happened in the worker, and
// those vectors ship alongside the catalog. All that is left at query time is
// encoding the search phrase and comparing it against them, which is small enough
// to run here. That is what removes the last reason to keep a server around.
//
// The text model is downloaded once (tens of megabytes) and then cached by the
// browser, so only the first search of a session pays for it.

import { readBinary } from '../storage/bucket';
import * as keys from '../storage/keys';
import { Manifest } from '../storage/catalog';

const EMBEDDING_DIM = 512;
// 8 bytes of item id, a float32 scale, then one int8 per dimension.
const RECORD_SIZE = 8 + 4 + EMBEDDING_DIM;

export interface ItemVector {
    itemId: number;
    vector: Float32Array;
}

// The text model is tens of megabytes and is fetched the first time anyone
// searches, so its progress has to be visible — otherwise the first search looks
// like it has hung. Once fetched the browser caches it, and later sessions skip
// straight past 'downloading'.
export type ModelStatus = 'idle' | 'preparing' | 'downloading' | 'ready';

export interface ModelLoadState {
    status: ModelStatus;
    percent: number;
}

let modelLoad: ModelLoadState = { status: 'idle', percent: 0 };
const listeners = new Set<() => void>();

const setModelLoad = (next: ModelLoadState) => {
    modelLoad = next;
    listeners.forEach(listener => listener());
};

export const getModelLoadState = () => modelLoad;

export const subscribeToModelLoad = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

interface ProgressEvent {
    status: string;
    file?: string;
    loaded?: number;
    total?: number;
}

const trackDownload = () => {
    // Weights arrive as several files at once, so progress is the sum rather than
    // whichever file reported last.
    const perFile = new Map<string, { loaded: number; total: number }>();

    return (event: ProgressEvent) => {
        if (event.status !== 'progress' || !event.file || !event.total) {
            return;
        }

        perFile.set(event.file, { loaded: event.loaded ?? 0, total: event.total });

        let loaded = 0;
        let total = 0;
        for (const file of perFile.values()) {
            loaded += file.loaded;
            total += file.total;
        }

        // Only bytes actually crossing the network flip this on, so a model served
        // from cache never shows a progress bar it would immediately dismiss.
        setModelLoad({ status: 'downloading', percent: total ? Math.round((loaded / total) * 100) : 0 });
    };
};

let textEncoder: Promise<(text: string) => Promise<Float32Array>> | null = null;

const loadTextEncoder = async (modelRepo: string) => {
    // Imported lazily so the model library stays out of the initial bundle; a user
    // who never searches never downloads it.
    setModelLoad({ status: 'preparing', percent: 0 });

    const { AutoTokenizer, CLIPTextModelWithProjection, env } = await import('@huggingface/transformers');

    env.allowLocalModels = false;

    const progress_callback = trackDownload();

    const tokenizer = await AutoTokenizer.from_pretrained(modelRepo, { progress_callback });
    const model = await CLIPTextModelWithProjection.from_pretrained(modelRepo, { dtype: 'q8', progress_callback });

    setModelLoad({ status: 'ready', percent: 100 });

    return async (text: string) => {
        const inputs = tokenizer([text], { padding: true, truncation: true });
        const { text_embeds } = await model(inputs);

        return normalize(Float32Array.from(text_embeds.data as Iterable<number>));
    };
};

export const encodeQuery = async (text: string, modelRepo: string) => {
    if (!textEncoder) {
        textEncoder = loadTextEncoder(modelRepo).catch(error => {
            // A failed load must not be cached, or every later search would reuse
            // the rejection and search would stay broken for the session.
            textEncoder = null;
            setModelLoad({ status: 'idle', percent: 0 });
            throw error;
        });
    }

    return (await textEncoder)(text);
};

export const loadVectors = async (manifest: Manifest): Promise<ItemVector[]> => {
    const months = await Promise.all(
        manifest.embeddings.months.map(month => readBinary(keys.embeddings(month)))
    );

    return months.filter((buffer): buffer is ArrayBuffer => !!buffer).flatMap(decodeVectors);
};

const decodeVectors = (buffer: ArrayBuffer): ItemVector[] => {
    const view = new DataView(buffer);
    const vectors: ItemVector[] = [];

    for (let offset = 0; offset + RECORD_SIZE <= buffer.byteLength; offset += RECORD_SIZE) {
        // Item ids exceed 32 bits, so they are read as a BigInt and narrowed —
        // they were generated to fit inside Number.MAX_SAFE_INTEGER.
        const itemId = Number(view.getBigUint64(offset, false));
        const scale = view.getFloat32(offset + 8, true);

        const quantized = new Int8Array(buffer, offset + 12, EMBEDDING_DIM);
        const vector = new Float32Array(EMBEDDING_DIM);
        for (let i = 0; i < EMBEDDING_DIM; i++) {
            vector[i] = quantized[i] * (scale / 127);
        }

        vectors.push({ itemId, vector: normalize(vector) });
    }

    return vectors;
};

export const rankBySimilarity = (query: Float32Array, vectors: ItemVector[], minScore: number, limit: number) => {
    const scored = vectors
        .map(({ itemId, vector }) => ({ itemId, score: dot(query, vector) }))
        .filter(result => result.score >= minScore);

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
};

const dot = (a: Float32Array, b: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
};

const normalize = (vector: Float32Array) => {
    let sum = 0;
    for (const value of vector) {
        sum += value * value;
    }

    const magnitude = Math.sqrt(sum);
    if (!magnitude) {
        return vector;
    }

    for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
    }
    return vector;
};
