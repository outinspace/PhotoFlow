import { useMemo, useState, useEffect } from 'react';
import { useAlbumsWithItems } from '../api/useAlbumsWithItems';
import { AlbumWithItems } from '../types';
import { useNavigate } from '@tanstack/react-router';
import { NavArrowDown, ViewGrid, List } from 'iconoir-react';
import { parseISO } from 'date-fns';
import { TopBar } from '../common/top.bar';
import { MediaImage } from '../common/media.image';
import { OptionMenu } from '../common/option.menu';

type SortOption = 'modified-recent' | 'name-asc';

const SORT_OPTIONS = [
    { value: 'modified-recent', label: 'Modified Date' },
    { value: 'name-asc', label: 'Name' }
];
type ViewMode = 'thumbnail' | 'list';

const STORAGE_KEYS = {
    SORT_OPTION: 'albums_sort_option',
    VIEW_MODE: 'albums_view_mode'
};

const Albums = () => {
    const navigate = useNavigate();
    const albums = useAlbumsWithItems() ?? [];

    const [sortOption, setSortOption] = useState<SortOption>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.SORT_OPTION);
        return (stored === 'modified-recent' || stored === 'name-asc') ? stored : 'modified-recent';
    });

    const [sortMenuOpen, setSortMenuOpen] = useState(false);

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
        return (stored === 'thumbnail' || stored === 'list') ? stored : 'thumbnail';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SORT_OPTION, sortOption);
    }, [sortOption]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode);
    }, [viewMode]);

    const sortedAlbums = useMemo(() => {
        const albumsCopy = [...albums];
        return albumsCopy.sort((a, b) => {
            switch (sortOption) {
                case 'modified-recent': {
                    // Get the most recent photo from each album
                    const getMostRecentPhotoTime = (album: AlbumWithItems) => {
                        if (album.items.length === 0) return 0;
                        return Math.max(...album.items.map(item => parseISO(item.captureTime).getTime()));
                    };

                    const aTime = getMostRecentPhotoTime(a);
                    const bTime = getMostRecentPhotoTime(b);

                    // Sort by most recent photo (descending)
                    return bTime - aTime;
                }
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });
    }, [albums, sortOption]);

    const openAlbum = (albumId: number) => {
        navigate({ to: '/album/$albumId', params: { albumId: albumId.toString() } });
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title='Albums'
            />
            <div className='flex flex-col overflow-auto tabbar-pad'>
                <div className='mx-5 mt-2 mb-4 flex items-center gap-4 justify-between'>
                    <div className='relative'>
                        <button
                            className='glass flex items-center gap-1.5 h-11 px-4 rounded-full text-[15px] font-medium cursor-pointer hover:bg-white/80'
                            onClick={() => setSortMenuOpen(true)}
                        >
                            Sort by {SORT_OPTIONS.find(option => option.value === sortOption)?.label}
                            <NavArrowDown className='size-4 text-slate-500' />
                        </button>
                        <OptionMenu
                            isOpen={sortMenuOpen}
                            onDismiss={() => setSortMenuOpen(false)}
                            options={SORT_OPTIONS}
                            value={sortOption}
                            onSelect={value => setSortOption(value as SortOption)}
                        />
                    </div>
                    <div className='glass flex h-11 p-1 gap-1 rounded-full'>
                        <button
                            className={`px-3 rounded-full flex items-center cursor-pointer ${viewMode === 'thumbnail'
                                ? 'bg-black/[0.07] text-sky-600'
                                : 'hover:bg-black/5'
                                }`}
                            onClick={() => setViewMode('thumbnail')}
                            title='Grid view'
                            aria-label='Grid view'
                        >
                            <ViewGrid className='size-5' />
                        </button>
                        <button
                            className={`px-3 rounded-full flex items-center cursor-pointer ${viewMode === 'list'
                                ? 'bg-black/[0.07] text-sky-600'
                                : 'hover:bg-black/5'
                                }`}
                            onClick={() => setViewMode('list')}
                            title='List view'
                            aria-label='List view'
                        >
                            <List className='size-5' />
                        </button>
                    </div>
                </div>
                {sortedAlbums.length === 0 ? (
                    // The only way to make an album is from a gallery selection, which
                    // is not somewhere you would think to look, so the empty state says so.
                    <div className='mx-5 rounded-2xl bg-white p-5 text-[15px] text-slate-600'>
                        No albums yet. Select photos in the gallery, then choose Create New Album.
                    </div>
                ) : viewMode === 'thumbnail' ? (
                    <div
                        className='w-full px-5 grid gap-x-3 gap-y-5'
                        style={{
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))'
                        }}
                    >
                        {sortedAlbums.map(album => (
                            <AlbumCover key={album.albumId} album={album} onClick={() => openAlbum(album.albumId)} />
                        ))}
                    </div>
                ) : (
                    <div className='mx-5 rounded-2xl bg-white overflow-hidden'>
                        {sortedAlbums.map(album => (
                            <AlbumListItem key={album.albumId} album={album} onClick={() => openAlbum(album.albumId)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface AlbumCoverProps {
    album: AlbumWithItems;
    onClick: Function;
}

const AlbumCover = ({ album, onClick }: AlbumCoverProps) => {
    let gridCols = 1;
    if (album.items.length >= 16) {
        gridCols = 4;
    } else if (album.items.length >= 9) {
        gridCols = 3;
    } else if (album.items.length >= 4) {
        gridCols = 2;
    }

    const gridTemplate = `repeat(${gridCols}, minmax(0, 1fr))`;
    const coverItems = album.items.slice(0, gridCols * gridCols);

    return (
        <div className='min-w-0 cursor-pointer transition-transform active:scale-[0.98]' onClick={() => onClick()}>
            <div className={'w-full aspect-square rounded-2xl overflow-hidden grid gap-px bg-slate-200 shadow-sm'}
                style={{
                    gridTemplateColumns: gridTemplate,
                    gridTemplateRows: gridTemplate
                }}
            >
                {coverItems.map(item => (
                    <MediaImage
                        key={item.itemId}
                        source={item.primaryFile.tileImageSource}
                        className='w-full h-full object-cover'
                    />
                ))}
            </div>
            <div className='mt-2 px-1 truncate text-[15px] font-semibold text-slate-900'>{album.name}</div>
            <div className='px-1 text-[13px] text-slate-500'>{album.items.length}</div>
        </div>
    )
}

interface AlbumListItemProps {
    album: AlbumWithItems;
    onClick: Function;
}

const AlbumListItem = ({ album, onClick }: AlbumListItemProps) => {
    const firstItem = album.items[0];
    const thumbnailSource = firstItem?.primaryFile.tileImageSource;

    return (
        <div
            className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 cursor-pointer'
            onClick={() => onClick()}
        >
            <div className='flex items-center gap-3 flex-1 min-w-0'>
                {thumbnailSource && (
                    <MediaImage
                        source={thumbnailSource}
                        className='size-12 rounded-xl object-cover flex-shrink-0 bg-slate-200'
                        alt=''
                    />
                )}
                <div className='truncate text-[15px] font-medium'>{album.name}</div>
            </div>
            <div className='text-sm text-slate-500 ml-4 flex-shrink-0'>
                {album.items.length} {album.items.length === 1 ? 'item' : 'items'}
            </div>
        </div>
    )
}

export default Albums;
