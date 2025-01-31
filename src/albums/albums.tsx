import React from 'react';
import PageHeader from '../common/page.header';
import { useAlbumsWithItems } from '../queries';
import { AlbumWithItems } from '../types';
import { useNavigate } from '@tanstack/react-router';

const Albums = () => {
    const navigate = useNavigate();
    const albums = useAlbumsWithItems() ?? [];

    const openAlbum = (albumId: number) => {
        navigate({ to: '/album', search: { albumId } });
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
                {albums.map(album => (
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
        <div className='flex-col m-1 justify-items-center' onClick={() => onClick()}>
            <div className={'rounded border border-slate-200 size-32 overflow-hidden grid'}
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
            <div className='mt-1 truncate text-ellipsis w-32'>{album.name}</div>
        </div>
    )
}

export default Albums;
