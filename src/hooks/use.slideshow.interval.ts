import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'settings_slideshow_interval_seconds';

export const SLIDESHOW_INTERVAL_OPTIONS_SECONDS = [4, 7, 10];
const DEFAULT_INTERVAL_SECONDS = SLIDESHOW_INTERVAL_OPTIONS_SECONDS[0];

const parseStored = (stored: string | null): number => {
    const value = Number(stored);
    return SLIDESHOW_INTERVAL_OPTIONS_SECONDS.includes(value) ? value : DEFAULT_INTERVAL_SECONDS;
};

export const useSlideshowInterval = () => {
    const [seconds, setSecondsState] = useState<number>(() => parseStored(localStorage.getItem(STORAGE_KEY)));

    const setSeconds = useCallback((value: number) => {
        setSecondsState(value);
        localStorage.setItem(STORAGE_KEY, String(value));
    }, []);

    // Listen for storage changes from other tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setSecondsState(parseStored(e.newValue));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return { seconds, setSeconds };
};
