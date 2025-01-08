import React, { useMemo } from 'react';
import { useGallery } from "../queries";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useSearch } from '@tanstack/react-router';

interface SearchParams {
    albumId?: number;
}

export const AlbumLayout = () => {
    const params: SearchParams = useSearch({ strict: false });

    // TODO: Use params instead of search
    if (!params.albumId) {
        throw new Error('AlbumId must be set');
    }

    const { data: gallery } = useGallery();
    const albums = gallery?.albums ?? [];

    const album = useMemo(() => albums.find(_ => _.albumId === params.albumId), [albums, params.albumId])

    if (!album) {
        return;
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title={album.name} />
            <ItemGrid items={album.items} />
        </div>
    );
}

