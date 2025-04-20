import {
    QueryClient,
} from '@tanstack/react-query'
import styled from '@emotion/styled';
import React, { StrictMode, useEffect } from 'react';
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

const cacheMaxAgeMs = 14 * 24 * 60 * 60 * 1000; // 14 days
const cacheVersion = 'v1'; // Changing this string will clear existing persisted cache

const persister = createIDBPersister('react-query');

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: cacheMaxAgeMs
        }
    }
})

const App = () => {

    // Redirect to login
    useEffect(() => {
        if (router.state.location.pathname === '/') {
            router.navigate({ to: '/login' });
        }
    }, []);

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
                <FlexContainer>
                    <RouterProvider router={router} />
                </FlexContainer>
            </PersistQueryClientProvider>
            <Toaster />
        </StrictMode>
    );
};

const FlexContainer = styled.div`
    display: flex;
    height: 100dvh;
    width: 100vw;
    overflow: auto;
    position: absolute;
    top: 0;
    left: 0;
`;

export default App;
