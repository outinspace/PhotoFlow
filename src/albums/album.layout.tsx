import React, { useMemo, useState } from 'react';
import { useAlbumsWithItems } from "../queries";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EditPencil, Trash } from 'iconoir-react';
import { DeleteAlbumModal } from './delete.album.modal';
import { EditAlbumModal } from './edit.album.modal';

interface SearchParams {
    albumId?: number;
}

export const AlbumLayout = () => {
    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const params: SearchParams = useSearch({ strict: false });

    // TODO: Use params instead of search
    if (!params.albumId) {
        throw new Error('AlbumId must be set');
    }

    const albums = useAlbumsWithItems() ?? [];
    const album = useMemo(() => {
        return albums.find(_ => _.albumId === params.albumId)
    }, [albums, params.albumId])

    if (!album) {
        return;
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={album.name}
                rightButtons={[
                    {
                        icon: EditPencil,
                        className: '',
                        onClick: () => setShowEditModal(true)
                    },
                    {
                        icon: Trash,
                        className: 'text-red-500',
                        onClick: () => setShowDeleteModal(true)
                    }
                ]}
            />
            <ItemGrid items={album.items} albumId={params.albumId} />
            <DeleteAlbumModal
                album={album}
                isOpen={showDeleteModal}
                onCancel={() => setShowDeleteModal(false)}
                onDeleteComplete={() => {
                    setShowDeleteModal(false);
                    navigate({ to: '/albums' });
                }}
            />
            <EditAlbumModal
                album={album}
                isOpen={showEditModal}
                onCancel={() => setShowEditModal(false)}
                onEditComplete={() => {
                    setShowEditModal(false);
                }}
            />
        </div>
    );
}

