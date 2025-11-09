import React, { useMemo } from 'react';
import PageHeader from '../common/page.header';
import { useAlbumsWithItems } from '../queries';
import { AlbumWithItems } from '../types';
import { useNavigate } from '@tanstack/react-router';

const Albums = () => {
    const navigate = useNavigate();
    const albums = useAlbumsWithItems() ?? [];

    const sortedAlbums = useMemo(() => {
        return albums.sort((a, b) => {
            // Sort by updatedTimeUtc first, falling back to createdTimeUtc if not available
            const aTime = a.updatedTimeUtc || a.createdTimeUtc;
            const bTime = b.updatedTimeUtc || b.createdTimeUtc;
            return bTime.localeCompare(aTime); // Most recent first
        });
    }, [albums]);

    const openAlbum = (albumId: number) => {
        navigate({ to: '/album/$albumId', params: { albumId: albumId.toString() } });
    }

    return (
        <div className='p-5'>
            <PageHeader name='Albums' />
            <div
                className='w-full grid justify-items-center justify-around md:justify-normal'
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min-content, 150px))'
                }}
            >
                {sortedAlbums.map(album => (
                    <AlbumCover key={album.albumId} album={album} onClick={() => openAlbum(album.albumId)} />
                ))}
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
        <div className='flex-col m-2 justify-items-center' onClick={() => onClick()}>
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

export default Albums;
