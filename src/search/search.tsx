import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, Xmark, Clock } from 'iconoir-react';
import PageHeader from '../common/page.header';
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
        <div className='h-1 w-full max-w-xs overflow-hidden rounded-full bg-slate-200'>
            <div
                className='h-full rounded-full bg-sky-500 transition-[width] duration-300'
                style={{ width: `${percent}%` }}
            />
        </div>
        <span className='block text-xs text-gray-400'>One-time download, then it works offline.</span>
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
            <div className='p-5 pb-2'>
                <PageHeader name='Search' />
                <div className='relative'>
                    <SearchIcon className='absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400' />
                    <input
                        type='text'
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder='Describe what you are looking for…'
                        className='w-full pl-10 pr-10 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white'
                    />
                    {query && (
                        <button
                            type='button'
                            onClick={() => setQuery('')}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                            aria-label='Clear search'
                        >
                            <Xmark className='size-5' />
                        </button>
                    )}
                </div>
                <div className='mt-2 text-sm text-gray-500 min-h-5'>
                    {error && <span className='text-red-600'>Search failed.</span>}
                    {!error && debouncedQuery && isLoadingVectors && <span>Loading search index…</span>}
                    {!error && debouncedQuery && !isLoadingVectors && isDownloadingModel && (
                        <ModelDownload percent={model.percent} />
                    )}
                    {!error && debouncedQuery && !isLoadingVectors && !isDownloadingModel && isFetching && <span>Searching…</span>}
                    {!error && debouncedQuery && !isFetching && results && (
                        <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
                    )}
                </div>
            </div>
            <div className='flex flex-auto overflow-hidden'>
                {debouncedQuery && deferredItems.length > 0 && (
                    <ItemGrid items={deferredItems} albumId={null} disableFilteringSorting />
                )}
                {!debouncedQuery && (
                    <div className='flex-auto overflow-y-auto px-5 pb-5 space-y-6'>
                        {recent.length > 0 && (
                            <section>
                                <div className='flex items-center justify-between mb-2'>
                                    <h2 className='text-sm font-semibold text-gray-500'>Recent</h2>
                                    <button
                                        type='button'
                                        onClick={clearRecent}
                                        className='text-sm text-sky-500 hover:text-sky-600'
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
                                            className='flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-100'
                                        >
                                            <Clock className='size-4 text-gray-400' />
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        <section>
                            <h2 className='text-sm font-semibold text-gray-500 mb-2'>Try searching for</h2>
                            <div className='flex flex-wrap gap-2'>
                                {EXAMPLE_QUERIES.map(q => (
                                    <button
                                        key={q}
                                        type='button'
                                        onClick={() => setQuery(q)}
                                        className='px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-100'
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
