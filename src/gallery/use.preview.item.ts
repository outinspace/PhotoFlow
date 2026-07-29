import { useCallback, useEffect, useState } from 'react';

const PREVIEW_PARAM = 'previewItemId';

export const readPreviewItemId = () => {
    const previewItemId = new URLSearchParams(window.location.search).get(PREVIEW_PARAM);
    return previewItemId === null ? null : parseInt(previewItemId, 10);
};

// Keeps the open photo in the URL so it can be shared and survives a refresh. Opening a photo
// pushes a history entry, so the back button closes it again; moving between photos and
// closing replace it, keeping the whole visit to one entry.
export const usePreviewItem = (enableUrlPersistence: boolean) => {
    const [previewItemId, setLocalPreviewItemId] = useState<number | null>(() =>
        enableUrlPersistence ? readPreviewItemId() : null
    );

    const setPreviewItemId = useCallback((itemId: number | null, replace: boolean = false) => {
        setLocalPreviewItemId(itemId);

        if (enableUrlPersistence) {
            const url = new URL(window.location.href);
            if (itemId === null) {
                url.searchParams.delete(PREVIEW_PARAM);
            } else {
                url.searchParams.set(PREVIEW_PARAM, itemId.toString());
            }

            if (replace) {
                window.history.replaceState({}, '', url.toString());
            } else {
                window.history.pushState({}, '', url.toString());
            }
        }
    }, [enableUrlPersistence]);

    // Listen for URL changes (back/forward navigation) only when URL persistence is enabled
    useEffect(() => {
        if (!enableUrlPersistence) return;

        const handlePopState = () => setLocalPreviewItemId(readPreviewItemId());

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [enableUrlPersistence]);

    return { previewItemId, setPreviewItemId };
};
