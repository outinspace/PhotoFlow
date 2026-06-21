import { useState, useCallback } from 'react';

const STORAGE_KEY = 'search_recent_queries';
const MAX_RECENT = 6;

const read = (): string[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string') : [];
    } catch {
        return [];
    }
};

export const useRecentSearches = () => {
    const [recent, setRecent] = useState<string[]>(read);

    const addRecent = useCallback((rawQuery: string) => {
        const query = rawQuery.trim();
        if (!query) return;
        setRecent(prev => {
            const deduped = [query, ...prev.filter(q => q.toLowerCase() !== query.toLowerCase())];
            const next = deduped.slice(0, MAX_RECENT);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecent([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return { recent, addRecent, clearRecent };
};
