import { useMemo, useState, useEffect } from 'react';
import PageHeader from '../common/page.header';
import { useAlbumsWithItems } from '../api/useAlbumsWithItems';
import { AlbumWithItems } from '../types';
import { useNavigate } from '@tanstack/react-router';
import { ViewGrid, List } from 'iconoir-react';
import { parseISO } from 'date-fns';
import { TopBar } from '../common/top.bar';

type SortOption = 'modified-recent' | 'name-asc';
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
            <div className='flex flex-col overflow-auto'>
                <div className='m-4 flex items-center gap-4 justify-between'>
                    <select
                        className='bg-slate-100 p-2 rounded-lg'
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as SortOption)}
                    >
                        <option value='modified-recent'>Sort by Modified Date</option>
                        <option value='name-asc'>Sort by Name</option>
                    </select>
                    <div className='flex border border-slate-100 rounded-lg overflow-hidden'>
                        <button
                            className={`p-2 flex items-center gap-1 ${viewMode === 'thumbnail'
                                ? 'bg-slate-200 text-sky-500'
                                : 'bg-slate-100 hover:bg-slate-200'
                                }`}
                            onClick={() => setViewMode('thumbnail')}
                        >
                            <ViewGrid className='size-5' />
                        </button>
                        <button
                            className={`p-2 flex items-center gap-1 border-l border-slate-200 ${viewMode === 'list'
                                ? 'bg-slate-200 text-sky-500'
                                : 'bg-slate-100 hover:bg-slate-200'
                                }`}
                            onClick={() => setViewMode('list')}
                        >
                            <List className='size-5' />
                        </button>
                    </div>
                </div>
                {viewMode === 'thumbnail' ? (
                    <div
                        className='w-full p-4 grid justify-items-center justify-around'
                        style={{
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))'
                        }}
                    >
                        {sortedAlbums.map(album => (
                            <AlbumCover key={album.albumId} album={album} onClick={() => openAlbum(album.albumId)} />
                        ))}
                    </div>
                ) : (
                    <div className='w-full p-4'>
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
        <div className='flex-col m-1 p-2 rounded justify-items-center hover:bg-slate-100 active:bg-slate-200' onClick={() => onClick()}>
            <div className={'rounded border border-slate-200 size-36 overflow-hidden grid'}
                style={{
                    gridTemplateColumns: gridTemplate,
                    gridTemplateRows: gridTemplate
                }}
            >
                {coverItems.map(item => (
                    <img
                        key={item.itemId}
                        src={item.primaryFile.tileImageUrl ?? ''}
                        className='w-full h-full object-cover'
                    />
                ))}
            </div>
            <div className='mt-1 truncate text-ellipsis w-36 text-sm text-center'>{album.name}</div>
        </div>
    )
}

interface AlbumListItemProps {
    album: AlbumWithItems;
    onClick: Function;
}

const AlbumListItem = ({ album, onClick }: AlbumListItemProps) => {
    const firstItem = album.items[0];
    const thumbnailUrl = firstItem?.primaryFile.tileImageUrl ?? '';

    return (
        <div
            className='flex items-center justify-between p-3 border-b border-slate-200 last:border-0 hover:bg-slate-100 active:bg-slate-200'
            onClick={() => onClick()}
        >
            <div className='flex items-center gap-3 flex-1 min-w-0'>
                {thumbnailUrl && (
                    <img
                        src={thumbnailUrl}
                        className='w-12 h-12 rounded border border-slate-200 object-cover flex-shrink-0'
                        alt=''
                    />
                )}
                <div className='truncate text-ellipsis text-base'>{album.name}</div>
            </div>
            <div className='text-sm text-slate-600 ml-4 flex-shrink-0'>
                {album.items.length} {album.items.length === 1 ? 'item' : 'items'}
            </div>
        </div>
    )
}

export default Albums;
