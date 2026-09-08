// Every deploy renames the hashed chunks, replaces src/dist/ on the static host,
// and — once the new service worker activates — drops the old chunks from the
// precache. A tab left open since the last deploy still holds the previous entry
// bundle, so the first lazy import it reaches (a map, the scanner, the search
// model) asks for a file that exists nowhere and the router's error boundary
// takes over the page. Reloading picks up the new build, and the position in the
// gallery is in the URL, so it comes back where it was.

const lastReloadKey = 'photoflow-stale-chunk-reload';
const cooldownMs = 10_000;

// A chunk can also be unreachable for reasons a reload cannot fix — offline, or a
// deploy that dropped a file — so reload at most once per cooldown and let the
// error through after that rather than reloading forever.
export const shouldReload = (lastReload: string | null, now: number) =>
    !(Number(lastReload) > now - cooldownMs);

export const reloadOnStaleChunk = () => {
    window.addEventListener('vite:preloadError', event => {
        if (!shouldReload(sessionStorage.getItem(lastReloadKey), Date.now())) return;
        sessionStorage.setItem(lastReloadKey, String(Date.now()));
        // Vite rethrows the failure unless it is cancelled here, which would show
        // the error boundary for the moment before the reload lands.
        event.preventDefault();
        window.location.reload();
    });
};
