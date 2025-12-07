import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'settings_autoplay_live_photos';

export const useAutoplayLivePhotos = () => {
    const [enabled, setEnabledState] = useState<boolean>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'true'; // Default to false
    });

    const setEnabled = useCallback((value: boolean) => {
        setEnabledState(value);
        localStorage.setItem(STORAGE_KEY, String(value));
    }, []);

    // Listen for storage changes from other tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setEnabledState(e.newValue === 'true');
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return { enabled, setEnabled };
};
