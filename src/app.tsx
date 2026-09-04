import {
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
const cacheVersion = 'v5';

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
                    buster: cacheVersion
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
