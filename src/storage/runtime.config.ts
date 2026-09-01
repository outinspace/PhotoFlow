// Deploy-time settings, read from a file served next to the app.
//
// Only share-link visitors need this. The owner's browser has its own stored
// config, but someone opening a shared album has never set anything up and still
// has to know where to read photos from. Keeping it in a fetched file rather than
// a build-time variable means one built artifact can be deployed by anyone, and
// changing where media lives does not mean rebuilding.
//
// If the app is served from the same domain as the photos, this file can say
// nothing at all and the app's own origin is used.

export interface RuntimeConfig {
    publicBaseUrl?: string;
}

const CONFIG_URL = '/photoflow.config.json';

let loaded: RuntimeConfig | null = null;
let pending: Promise<RuntimeConfig> | null = null;

export const loadRuntimeConfig = (): Promise<RuntimeConfig> => {
    if (loaded) {
        return Promise.resolve(loaded);
    }

    pending = pending ?? fetch(CONFIG_URL)
        .then(res => res.ok ? res.json() : {})
        .catch(() => ({}))
        .then((config: RuntimeConfig) => {
            loaded = config;
            return config;
        });

    return pending;
};

export const getLoadedRuntimeConfig = () => loaded;
