import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTile, reportGridScroll, setTilesToPrefetch } from '../tile.loader';

// What the loader exists to prevent: a browser handed more thumbnails than it can
// carry accepts every one of them, and will not afterwards reorder or drop any. The
// tiles on screen then arrive behind hundreds already scrolled past, and no amount
// of cancelling on the page can take them back.
//
// Every property below is invisible when it breaks — the gallery still works, only
// slowly — so none of it is safe to leave unchecked.

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

afterEach(async () => {
    vi.useRealTimers();

    // The loader is one queue for the whole app, so anything this case left in it
    // would change what the next one sees. Draining it uses the same calls the
    // gallery does: an empty list, and one tile appearing to reclaim the rest.
    setTilesToPrefetch([]);
    loadTile(() => undefined)();
    await tick();

    reportGridScroll(0);
    vi.unstubAllGlobals();
});

describe('admitting thumbnails a few at a time', () => {
    it('starts no more at once than the connections can carry', () => {
        const started: number[] = [];
        const release = Array.from({ length: 20 }, (_, index) =>
            loadTile(() => started.push(index))
        );

        expect(started).toHaveLength(12);

        release.forEach(free => free());
    });

    it('starts a waiting tile as soon as one finishes', () => {
        const started: number[] = [];
        const release = Array.from({ length: 13 }, (_, index) =>
            loadTile(() => started.push(index))
        );

        expect(started).not.toContain(12);

        release[0]();
        expect(started).toContain(12);

        release.forEach(free => free());
    });

    it('drops a tile that scrolled away before its turn came', () => {
        // The whole point. These were requested and never started, so they are
        // still the page's to take back — which is what an <img> already dispatched
        // is not.
        const started: number[] = [];
        const release = Array.from({ length: 20 }, (_, index) =>
            loadTile(() => started.push(index))
        );

        for (let index = 12; index < 20; index++) {
            release[index]();
        }

        // Freeing a connection must not now spend it on a tile nobody is looking at.
        release[0]();
        expect(started).toHaveLength(12);

        release.forEach(free => free());
    });

    it('takes one call to cancel or to release, in either order', () => {
        // A tile hands the same function to its unmount and to the image's load
        // handler without knowing which will run first.
        const release = loadTile(() => undefined);

        release();
        release();

        const started: number[] = [];
        const second = Array.from({ length: 12 }, (_, index) => loadTile(() => started.push(index)));
        expect(started).toHaveLength(12);

        second.forEach(free => free());
    });
});

describe('holding back while the grid is moving', () => {
    it('waits out a flick, then loads once the grid stops', () => {
        vi.useFakeTimers();

        reportGridScroll(30);

        const started: string[] = [];
        const release = loadTile(() => started.push('tile'));
        expect(started).toEqual([]);

        // No further scroll events arrive, which is how a flick that ends abruptly
        // looks: its last reported velocity is still fast.
        vi.advanceTimersByTime(200);
        expect(started).toEqual(['tile']);

        release();
    });

    it('loads straight away while the grid is browsed slowly', () => {
        // Scrolling slowly means the user is looking at what goes past, so holding
        // tiles back would be the wrong thing to do.
        reportGridScroll(0.4);

        const started: string[] = [];
        const release = loadTile(() => started.push('tile'));

        expect(started).toEqual(['tile']);
        release();
    });
});

describe('reading ahead', () => {
    const config = {
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
        bucket: 'my-photos',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-west-004'
    };

    const installStorage = () => vi.stubGlobal('localStorage', {
        getItem: (key: string) => (key === 'photoflow.storage' ? JSON.stringify(config) : null),
        setItem: () => undefined,
        removeItem: () => undefined
    });

    /**
     * Records what was asked for and leaves each request outstanding, so what is in
     * flight stays in flight until something cancels it — which is the state these
     * cases are about. Aborts the way the real thing does, including for a signal
     * that was already aborted before the call.
     */
    const installFetch = () => {
        const asked: string[] = [];
        const aborted: string[] = [];

        vi.stubGlobal('fetch', (url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            asked.push(String(url));

            const giveUp = () => {
                aborted.push(String(url));
                reject(new DOMException('Aborted', 'AbortError'));
            };

            if (init.signal?.aborted) {
                giveUp();
                return;
            }
            init.signal?.addEventListener('abort', giveUp);
        }));

        const names = (urls: string[]) => urls.map(url => new URL(url).pathname.split('/').pop()).sort();

        return { asked, aborted, names };
    };

    const sources = ['one', 'two', 'three', 'four'].map(name => `tile-image/ahead-${name}.jpeg`);

    it('starts only once nothing on screen is waiting', async () => {
        installStorage();
        const { asked, names } = installFetch();

        const release = loadTile(() => undefined);
        setTilesToPrefetch(sources);

        await tick();
        expect(asked).toEqual([]);

        // The screen is served, so the spare connections may go to reading ahead.
        release();
        await vi.waitFor(() => expect(asked).toHaveLength(2));

        // Two at a time, taken from the front of the list — the order the gallery
        // will reach them in. Which of the two is signed first is a race and does
        // not matter; that the third and fourth wait for a free slot does.
        expect(names(asked)).toEqual(['ahead-one.jpeg', 'ahead-two.jpeg']);

        // Signed, because the bucket is private even for a picture nobody asked for.
        expect(asked[0]).toContain('X-Amz-Signature=');
    });

    it('gives its connections back to a tile on screen', async () => {
        installStorage();
        const { asked, aborted, names } = installFetch();

        setTilesToPrefetch(sources);
        await vi.waitFor(() => expect(asked).toHaveLength(2));
        expect(aborted).toEqual([]);

        // A tile scrolls into view while reading ahead holds the connections.
        const release = loadTile(() => undefined);
        await vi.waitFor(() => expect(aborted).toHaveLength(2));

        release();

        // Cancelled rather than merely deprioritised, and put back at the front of
        // the list: a picture given up on must not be skipped for the session.
        await vi.waitFor(() => expect(asked).toHaveLength(4));
        expect(names(asked.slice(2))).toEqual(['ahead-one.jpeg', 'ahead-two.jpeg']);
    });
});
