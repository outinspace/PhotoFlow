import { createRoot } from 'react-dom/client';
import App from './app';

// Clear the existing HTML content
document.body.innerHTML = '<div id="app"></div>';

const root = createRoot(document.getElementById('app'));
root.render(<App />);
