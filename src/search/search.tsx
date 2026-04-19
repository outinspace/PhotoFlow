import { useDeferredValue, useMemo, useState } from 'react';
import { Search as SearchIcon, Xmark } from 'iconoir-react';
import PageHeader from '../common/page.header';
import ItemGrid from '../gallery/item.grid';
import { useGallery } from '../api/useGallery';
import { useSearch } from '../api/useSearch';
import { useDebouncedValue } from '../hooks/use.debounced.value';
import { Item } from '../types';

const Search = () => {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query.trim(), 300);

    const { data: gallery } = useGallery();
    const { data: results, isFetching, error } = useSearch(debouncedQuery);

    const items = useMemo<Item[]>(() => {
        if (!results || !gallery) return [];
        const itemsById: Record<number, Item> = {};
        for (const item of gallery.items) itemsById[item.itemId] = item;
        return results
            .map(r => itemsById[r.itemId])
            .filter((i): i is Item => Boolean(i));
    }, [results, gallery]);
    const deferredItems = useDeferredValue(items);

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
                <div className='mt-2 text-sm text-gray-500 h-5'>
                    {error && <span className='text-red-600'>Search failed.</span>}
                    {!error && debouncedQuery && isFetching && <span>Searching…</span>}
                    {!error && debouncedQuery && !isFetching && results && (
                        <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
                    )}
                </div>
            </div>
            <div className='flex flex-auto overflow-hidden'>
                {debouncedQuery && deferredItems.length > 0 && (
                    <ItemGrid items={deferredItems} albumId={null} disableFilteringSorting initialZoomLevelIndex={3} />
                )}
            </div>
        </div>
    );
};

export default Search;
