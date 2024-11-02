import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import styled from '@emotion/styled';
import React, { StrictMode } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes';

const queryClient = new QueryClient()

const App = () => {
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
    height: 100vh;
    width: 100vw;
    overflow: auto;
    position: absolute;
    top: 0;
    left: 0;
`;

export default App;
