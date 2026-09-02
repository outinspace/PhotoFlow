import { useQuery } from '@tanstack/react-query';
import * as keys from './keys';
import { listObjects } from './bucket';

// What is sitting in incoming/, waiting for the next processing run.
//
// This is the one question the catalog cannot answer: an upload has no catalog
// entry until the worker has processed it, so "what arrived since last night" is
// only visible by listing the bucket directly.

export interface IncomingQueue {
    count: number;
    bytes: number;
    names: string[];
    truncated: boolean;
}

export const useIncomingQueue = () => useQuery({
    queryKey: ['incoming'],
    // Always revalidate on mount. The query cache is persisted, so a remembered
    // count would otherwise claim files are still waiting after they have been
    // processed — the one thing this panel must not get wrong. Cached data still
    // renders immediately while the fresh count arrives.
    staleTime: 0,
    queryFn: async (): Promise<IncomingQueue> => {
        const { objects, truncated } = await listObjects(keys.INCOMING);

        // Some tools create a zero-byte object to stand for the folder itself.
        const files = objects.filter(object => object.size > 0 && !object.key.endsWith('/'));

        return {
            count: files.length,
            bytes: files.reduce((total, file) => total + file.size, 0),
            names: files.map(file => file.key.slice(keys.INCOMING.length)),
            truncated
        };
    }
});
