import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import Gallery from './gallery/gallery';

const queryClient = new QueryClient()

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Gallery />
    </QueryClientProvider>
  );
};

export default App;
