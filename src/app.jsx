import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import Gallery from './gallery/gallery';
import styled from '@emotion/styled';

const queryClient = new QueryClient()

const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <FlexContainer>
                <Gallery />
            </FlexContainer>
        </QueryClientProvider>
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
