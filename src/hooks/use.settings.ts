import { useState, useEffect, useCallback } from 'react';

// Reads and writes one localStorage-backed setting, staying in sync with other tabs.
// `parse` turns the raw stored string — null when nothing has been stored — into the
// value, so it also decides the default.
const useStoredSetting = <T>(key: string, parse: (stored: string | null) => T) => {
    const [value, setValue] = useState<T>(() => parse(localStorage.getItem(key)));

    const store = useCallback((newValue: T) => {
        setValue(newValue);
        localStorage.setItem(key, String(newValue));
    }, [key]);

    // Listen for storage changes from other tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key) {
                setValue(parse(e.newValue));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, parse]);

    return [value, store] as const;
};

// Defined at module level so their identity is stable across renders.
const parseEnabledByDefault = (stored: string | null) => stored !== 'false';
const parseDisabledByDefault = (stored: string | null) => stored === 'true';

const DEFAULT_TO_MEMORIES_KEY = 'settings_default_to_memories';

export const useAutoplayVideos = () => useStoredSetting('settings_autoplay_videos', parseEnabledByDefault);

export const usePhotoAnimations = () => useStoredSetting('settings_photo_animations', parseEnabledByDefault);

export const useAutoplayLivePhotos = () => useStoredSetting('settings_autoplay_live_photos', parseDisabledByDefault);

export const useDefaultToMemories = () => useStoredSetting(DEFAULT_TO_MEMORIES_KEY, parseDisabledByDefault);

// Route guards run outside React and need this before any component has mounted.
export const getDefaultToMemories = () => parseDisabledByDefault(localStorage.getItem(DEFAULT_TO_MEMORIES_KEY));

// On by default. A bucket endpoint allows only a handful of parallel downloads, so
// reading ahead is most of what makes scrolling feel instant, and the data it uses
// is the user's own. Off is for a metered connection.
export const usePrefetchThumbnails = () => useStoredSetting('settings_prefetch_thumbnails', parseEnabledByDefault);

// The map opens flat and stays on whichever projection was last chosen.
export const useMapGlobe = () => useStoredSetting('settings_map_globe', parseDisabledByDefault);

// Null until the user zooms the grid, so it can start from a screen-size default instead.
const parseGridColumns = (stored: string | null) => {
    const value = Number(stored);
    return Number.isInteger(value) && value > 0 ? value : null;
};

export const useGridColumns = () => useStoredSetting('settings_grid_columns', parseGridColumns);

export const SLIDESHOW_INTERVAL_OPTIONS_SECONDS = [3, 4, 7, 10];

const parseSlideshowInterval = (stored: string | null) => {
    const value = Number(stored);
    return SLIDESHOW_INTERVAL_OPTIONS_SECONDS.includes(value) ? value : SLIDESHOW_INTERVAL_OPTIONS_SECONDS[0];
};

export const useSlideshowInterval = () => useStoredSetting('settings_slideshow_interval_seconds', parseSlideshowInterval);
