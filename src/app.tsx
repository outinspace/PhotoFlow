import {
    defaultShouldDehydrateQuery,
    QueryClient,
} from '@tanstack/react-query'
import { StrictMode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes';
import { get, set, del } from "idb-keyval";
import { PersistedClient, Persister } from '@tanstack/query-persist-client-core';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'react-hot-toast';
import { GlobalLoadingBar } from './components/LoadingBar';

export function createIDBPersister(idbValidKey: IDBValidKey) {
    return {
        persistClient: async (client: PersistedClient) => {
            await set(idbValidKey, client)
        },
        restoreClient: async () => {
            return await get<PersistedClient>(idbValidKey)
        },
        removeClient: async () => {
            await del(idbValidKey)
        },
    } as Persister
}

const cacheMaxAgeMs = 24 * 24 * 60 * 60 * 1000; // 24 days is max supported: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
// Changing this string will clear existing persisted cache.
const cacheVersion = 'v6';

// Search vectors are about 2KB a photo and the service worker already caches
// them. Persisted here, the whole set was structured-cloned into IndexedDB on
// every cache event, and each superseded set (one per manifest) was kept and
// restored on every launch, which is a lot of memory to spend on a phone.
const neverPersisted = new Set(['search', 'search-vectors']);
const shouldDehydrateQuery: typeof defaultShouldDehydrateQuery = query =>
    defaultShouldDehydrateQuery(query) && !neverPersisted.has(query.queryKey[0] as string);

const persister = createIDBPersister('react-query');

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: cacheMaxAgeMs,
            refetchOnWindowFocus: false // Don't refresh on browser tab focus
        }
    }
})

const App = () => {
    return (
        <StrictMode>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{
                    persister,
                    maxAge: cacheMaxAgeMs,
                    buster: cacheVersion,
                    dehydrateOptions: { shouldDehydrateQuery }
                }}
            >
                <GlobalLoadingBar />
                <div className='absolute top-0 left-0 flex h-dvh w-screen overflow-auto'>
                    <RouterProvider router={router} />
                </div>
            </PersistQueryClientProvider>
            <Toaster />
        </StrictMode>
    );
};

export default App;
