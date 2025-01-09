import React, { useMemo } from 'react';
import PageHeader from '../common/page.header';
import { useAlbumsWithItems, useGallery } from '../queries';
import { Album } from '../types';
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
            <div className='flex flex-wrap'>
                {albums.map(album => (
                    <AlbumCover key={album.albumId} album={album} onClick={() => openAlbum(album.albumId)} />
                ))}
            </div>
        </div>
    );
};

interface AlbumCoverProps {
    album: Album;
    onClick: Function;
}

const AlbumCover = ({ album, onClick }: AlbumCoverProps) => {
    const coverItems = album.items.slice(0, 3);

    return (
        <div className='size-40 border' onClick={() => onClick()}>
            <div>
                {coverItems.map(item => (
                    <img key={item.itemId} src={item.primaryFile.tileImageUrl ?? ''} />
                ))}
            </div>
            {album.name}
        </div>
    )
}

export default Albums;
