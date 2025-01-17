import React, { useMemo, useState } from 'react';
import { useAlbumsWithItems } from "../queries";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EditPencil, Link, Menu, Trash } from 'iconoir-react';
import { DeleteAlbumModal } from './delete.album.modal';
import { EditAlbumModal } from './edit.album.modal';
import { ActionMenu } from '../common/action.menu';

interface SearchParams {
    albumId?: number;
}

export const AlbumLayout = () => {
    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionMenuActive, setActionMenuActive] = useState(false);
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

    const actionOptions = [
        {
            title: 'Copy Public Link',
            onClick: () => setShowEditModal(true),
            icon: Link
        },
        {
            title: 'Edit',
            onClick: () => setShowEditModal(true),
            icon: EditPencil
        },
        {
            title: 'Delete',
            onClick: () => setShowDeleteModal(true),
            icon: Trash,
            className: 'text-red-500'
        },
    ];

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={album.name}
                rightButtons={[
                    {
                        icon: Menu,
                        className: '',
                        onClick: () => setActionMenuActive(true),
                        children: actionMenuActive && (
                            <ActionMenu
                                onActionStarted={() => setActionMenuActive(false)}
                                onDismiss={() => setActionMenuActive(false)}
                                position='bottom'
                                options={actionOptions}
                            />
                        )
                    }
                ]}
                onTitleClick={() => setShowEditModal(true)}
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

