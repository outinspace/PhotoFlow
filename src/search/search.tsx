import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, Xmark, Clock, Lock } from 'iconoir-react';
import ItemGrid from '../gallery/item.grid';
import { useItems } from '../api/useItems';
import { useSearch } from '../api/useSearch';
import { useDebouncedValue } from '../hooks/use.debounced.value';
import { useRecentSearches } from '../hooks/use.recent.searches';
import { Item } from '../types';

const EXAMPLE_QUERIES = ['beach', 'birthday cake', 'boats on a lake', 'documents', 'pets', 'sunsets'];

// Searching happens entirely on this device, which means fetching the language
// model once. Saying so is better than an unexplained wait on the first search.
//
// This appears only while model weights are actually crossing the network. The
// short wait before that — importing the search code itself — gets the ordinary
// "Searching…" text, since a progress bar with nothing to measure reads as a stall.
const ModelDownload = ({ percent }: { percent: number }) => (
    <div className='space-y-1.5'>
        <span>Setting up search on this device — {percent}%</span>
        <div className='h-1 w-full max-w-xs overflow-hidden rounded-full bg-slate-300'>
            <div
                className='h-full rounded-full bg-sky-500 transition-[width] duration-300'
                style={{ width: `${percent}%` }}
            />
        </div>
        <span className='block text-xs text-slate-500'>One-time download, then it works offline.</span>
    </div>
);

const Search = () => {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query.trim(), 500);

    const { data: libraryItems } = useItems();
    const { data: results, isFetching, error, isLoadingVectors, model } = useSearch(debouncedQuery);
    const { recent, addRecent, clearRecent } = useRecentSearches();

    // Only the first search on this device pays for this; afterwards the model is
    // in the browser cache and it never appears again.
    const isDownloadingModel = model.status === 'downloading';

    const items = useMemo<Item[]>(() => {
        if (!results || !libraryItems) return [];
        const itemsById: Record<number, Item> = {};
        for (const item of libraryItems) itemsById[item.itemId] = item;
        return results
            .map(r => itemsById[r.itemId])
            .filter((i): i is Item => Boolean(i));
    }, [results, libraryItems]);
    const deferredItems = useDeferredValue(items);

    // Record a search once it returns results, so we don't store every keystroke.
    useEffect(() => {
        if (debouncedQuery && !isFetching && results && results.length > 0) {
            addRecent(debouncedQuery);
        }
    }, [debouncedQuery, isFetching, results, addRecent]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <div className='px-5 pt-4 pb-3'>
                <h1 className='text-[34px] font-bold tracking-tight text-slate-900 pb-4'>Search</h1>
                <div className='relative'>
                    <SearchIcon className='absolute z-10 left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500 pointer-events-none' />
                    <input
                        type='text'
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder='Photos, places, things…'
                        className='glass w-full h-13 pl-12 pr-12 rounded-full text-[17px] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500'
                    />
                    {query && (
                        <button
                            type='button'
                            onClick={() => setQuery('')}
                            className='absolute z-10 right-2 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-black/5'
                            aria-label='Clear search'
                        >
                            <Xmark className='size-5' />
                        </button>
                    )}
                </div>
                <div className='mt-3 px-1 text-sm text-slate-500 min-h-5'>
                    {error && <span className='text-red-600'>Search failed.</span>}
                    {!error && debouncedQuery && isLoadingVectors && <span>Loading search index…</span>}
                    {!error && debouncedQuery && !isLoadingVectors && isDownloadingModel && (
                        <ModelDownload percent={model.percent} />
                    )}
                    {!error && debouncedQuery && !isLoadingVectors && !isDownloadingModel && isFetching && <span>Searching…</span>}
                    {!error && debouncedQuery && !isFetching && results && (
                        <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
                    )}
                    {!debouncedQuery && (
                        <span className='flex items-center gap-1.5'>
                            <Lock className='size-4' />
                            Searched on this device. Your query never leaves it.
                        </span>
                    )}
                </div>
            </div>
            <div className='flex flex-auto overflow-hidden'>
                {debouncedQuery && deferredItems.length > 0 && (
                    <ItemGrid items={deferredItems} albumId={null} disableFilteringSorting />
                )}
                {!debouncedQuery && (
                    <div className='flex-auto overflow-y-auto px-5 pt-3 space-y-7 tabbar-pad'>
                        {recent.length > 0 && (
                            <section>
                                <div className='flex items-center justify-between mb-2'>
                                    <h2 className='text-[13px] font-semibold uppercase tracking-wide text-slate-500'>Recent</h2>
                                    <button
                                        type='button'
                                        onClick={clearRecent}
                                        className='text-[15px] font-medium text-sky-600 hover:text-sky-700'
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    {recent.map(q => (
                                        <button
                                            key={q}
                                            type='button'
                                            onClick={() => setQuery(q)}
                                            className='flex items-center gap-1.5 h-10 px-4 rounded-full bg-white text-[15px] text-slate-800 shadow-sm hover:bg-slate-50 cursor-pointer'
                                        >
                                            <Clock className='size-4 text-slate-400' />
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        <section>
                            <h2 className='text-[13px] font-semibold uppercase tracking-wide text-slate-500 mb-2'>Try searching for</h2>
                            <div className='flex flex-wrap gap-2'>
                                {EXAMPLE_QUERIES.map(q => (
                                    <button
                                        key={q}
                                        type='button'
                                        onClick={() => setQuery(q)}
                                        className='h-10 px-4 rounded-full bg-white text-[15px] text-slate-800 shadow-sm hover:bg-slate-50 cursor-pointer'
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Search;
