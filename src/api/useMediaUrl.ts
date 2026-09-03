import { useEffect, useState } from 'react';
import { mediaUrl, peekMediaUrl } from '../storage/bucket';

// Turns a bucket key into a URL the browser can load.
//
// Signing is asynchronous, so the first render of an object it has not signed yet
// returns null and the caller shows whatever placeholder it already has. Signatures
// are cached for the day, so remounting a tile — which the grid does on every
// reflow — resolves synchronously and does not flash.

export const useMediaUrl = (source: string | null | undefined): string | null => {
    const [url, setUrl] = useState<string | null>(() => (source ? peekMediaUrl(source) : null));

    useEffect(() => {
        if (!source) {
            setUrl(null);
            return;
        }

        const alreadySigned = peekMediaUrl(source);
        if (alreadySigned) {
            setUrl(alreadySigned);
            return;
        }

        // Guarded rather than aborted: a signature is pure computation, so letting
        // it finish costs nothing, but applying it to an unmounted tile would warn.
        let active = true;

        mediaUrl(source)
            .then(signed => active && setUrl(signed))
            .catch(() => active && setUrl(null));

        return () => { active = false; };
    }, [source]);

    return url;
};
