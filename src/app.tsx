import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import styled from '@emotion/styled';
import React, { StrictMode, useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes';

const queryClient = new QueryClient()

const App = () => {

    // Redirect to login
    useEffect(() => {
        if (router.state.location.pathname === '/') {
            router.navigate({ to: '/login' });
        }
    }, []);

    return (
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <FlexContainer>
                    <RouterProvider router={router} />
                </FlexContainer>
            </QueryClientProvider>
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
