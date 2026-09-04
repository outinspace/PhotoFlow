import { mediaUrl } from '../storage/bucket';

// Every thumbnail the gallery renders is admitted through here rather than being
// handed straight to the browser.
//
// A bucket endpoint speaks HTTP/1.1, where browsers allow about six connections per
// hostname. Given hundreds of tiles at once the browser accepts all of them, queues
// them internally in the order they were requested, and will neither reorder that
// queue nor drop anything from it. Scrolling past a few screens therefore leaves
// the tiles actually on screen waiting behind hundreds already scrolled past.
//
// So requests wait here instead, where a tile that scrolls away before it started
// is simply removed. That is also why nothing here tries to cancel a request that
// has already begun: an <img> cannot reliably be aborted — WebKit ignores clearing
// src — and the fix is to not start it in the first place.

// Two hostnames serve the bucket, at roughly six connections each.
//
// ponytail: one number for every setup. A bucket with no second hostname gets six
// lanes rather than twelve, so half of these queue inside the browser where they
// can no longer be taken back — six stuck requests against the hundreds this
// exists to prevent. Make it depend on the connection if that ever shows up.
const MAX_IN_FLIGHT = 12;

// Left for reading ahead, once nothing on screen is waiting. Deliberately small: a
// tile the user is looking at must never queue behind one they may never reach.
const MAX_PREFETCHING = 2;

// How many items ahead of the viewport are prefetched. A ceiling rather than the
// whole library, so a slow scroll through a large library cannot leave thousands of
// requests outstanding.
export const PREFETCH_AHEAD_ITEMS = 1000;

// Above this the grid is moving faster than anyone can look at it, so nothing new
// starts until it slows or stops.
const FAST_SCROLL_PIXELS_PER_MS = 2;

// How long after the last scroll event the grid counts as stopped. A flick that
// ends abruptly reports its final velocity while still fast, so without this the
// queue would stay shut for good.
const SETTLE_MS = 120;

interface Job {
    start: () => void;
    started: boolean;
    done: boolean;
}

const waiting: Job[] = [];
let inFlight = 0;

let scrollingFast = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

let prefetchSources: string[] = [];
let prefetchNext = 0;
let prefetching = 0;
const prefetched = new Set<string>();
const prefetchRequests = new Set<AbortController>();

/**
 * Asks for a slot to load one thumbnail.
 *
 * `start` is called when the network has room, which may be immediately or never.
 * The returned function both cancels — before `start` has run — and releases the
 * slot afterwards, so a caller can hand it to an unmount and to the image's own
 * load and error handlers without tracking which came first.
 */
// ponytail: a slot is held until the caller gives it back, and an image that never
// fires load or error holds one until the browser's own network timeout. Twelve of
// those would stall the gallery. Add a timeout here if that is ever seen.
export const loadTile = (start: () => void): (() => void) => {
    const job: Job = { start, started: false, done: false };
    waiting.push(job);

    // Something on screen needs the network, so stop reading ahead.
    stopPrefetching();
    pump();

    return () => finish(job);
};

const finish = (job: Job) => {
    if (job.done) {
        return;
    }
    job.done = true;

    if (job.started) {
        inFlight--;
    } else {
        const at = waiting.indexOf(job);
        if (at >= 0) {
            waiting.splice(at, 1);
        }
    }

    pump();
};

/**
 * The items to read ahead, in the order they should be fetched.
 *
 * The gallery passes the keys of the photos after the ones on screen, so they
 * arrive in the order they will be scrolled to. Passing an empty list turns
 * reading ahead off.
 */
export const setTilesToPrefetch = (sources: string[]) => {
    prefetchSources = sources;
    prefetchNext = 0;
    pump();
};

/**
 * How fast the grid is scrolling, in pixels per millisecond.
 *
 * Called from the grid's own scroll handler. A slow scroll means the user is
 * looking and tiles load as they appear; a fast one holds them back, because most
 * will have gone by before they arrive.
 */
export const reportGridScroll = (pixelsPerMs: number) => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);

    if (pixelsPerMs <= FAST_SCROLL_PIXELS_PER_MS) {
        settle();
        return;
    }

    scrollingFast = true;
    stopPrefetching();
};

const settle = () => {
    if (!scrollingFast) {
        return;
    }

    scrollingFast = false;
    pump();
};

const pump = () => {
    while (!scrollingFast && inFlight < MAX_IN_FLIGHT && waiting.length > 0) {
        const job = waiting.shift()!;
        job.started = true;
        inFlight++;

        try {
            job.start();
        } catch {
            // Nothing here should throw, but a slot never given back would wedge
            // the queue and leave the gallery blank rather than merely slow.
            job.done = true;
            inFlight--;
        }
    }

    // Reading ahead only once the screen itself is settled and served.
    if (scrollingFast || waiting.length > 0 || inFlight > 0) {
        return;
    }

    while (prefetching < MAX_PREFETCHING) {
        const source = nextToPrefetch();
        if (!source) {
            return;
        }
        prefetch(source);
    }
};

const nextToPrefetch = (): string | null => {
    while (prefetchNext < prefetchSources.length) {
        const source = prefetchSources[prefetchNext++];
        if (source && !prefetched.has(source)) {
            return source;
        }
    }

    return null;
};

const prefetch = (source: string) => {
    prefetched.add(source);
    prefetching++;

    const request = new AbortController();
    prefetchRequests.add(request);

    mediaUrl(source)
        // Low priority so the browser puts anything the page is actually showing
        // first. Ignored where unsupported, which costs nothing.
        .then(url => fetch(url, { signal: request.signal, priority: 'low' } as RequestInit))
        // The body is read and dropped. The point is the service worker's copy,
        // made as it passed through; leaving it unread holds the connection open.
        .then(res => res.arrayBuffer())
        .catch(() => {
            // An aborted read-ahead has not happened yet, so let a later pass have
            // it. Anything else failed for a reason that will not change, and the
            // tile will fetch it for itself when it is reached.
            if (request.signal.aborted) {
                prefetched.delete(source);
            }
        })
        .finally(() => {
            prefetchRequests.delete(request);
            prefetching--;
            pump();
        });
};

const stopPrefetching = () => {
    for (const request of prefetchRequests) {
        request.abort();
    }

    // Back to the front of the list. What was given up on is put back by the abort
    // itself, and the walk only ever moves forward, so without this a picture
    // interrupted once would be skipped until the gallery next changed the list.
    // Re-walking is a scan of a list already in hand, against pictures already
    // fetched, so it costs nothing worth saving.
    prefetchNext = 0;
};
