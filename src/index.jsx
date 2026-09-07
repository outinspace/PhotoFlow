import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import "@fontsource-variable/inter";
import App from './app';

Sentry.init({
  dsn: "https://fd75fe2f520c15841150a64c9b8aef4f@o4511202934521856.ingest.us.sentry.io/4512047047639040",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  }
});

const root = createRoot(document.getElementById('root'));
root.render(<App />);
