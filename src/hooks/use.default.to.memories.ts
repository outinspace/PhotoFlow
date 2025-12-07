import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'settings_default_to_memories';

export const useDefaultToMemories = () => {
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

// Helper function to read the setting synchronously (for use in routes)
export const getDefaultToMemories = (): boolean => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
};
