import React, { useMemo, useState } from 'react';
import { useAlbumsWithItems, useShareAlbum } from "../queries";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EditPencil, Link, Menu, Trash } from 'iconoir-react';
import { DeleteAlbumModal } from './delete.album.modal';
import { EditAlbumModal } from './edit.album.modal';
import { ActionMenu } from '../common/action.menu';
import { compactGUID } from '../common/format.helpers';
import { Ellipsis } from '../common/ellipsis';

interface SearchParams {
    albumId?: number;
}

export const AlbumLayout = () => {
    const navigate = useNavigate();
    const shareAlbumMutation = useShareAlbum();

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

    const navigateToPublicLink = async () => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) {
            return;
        }

        const shareSecret = await shareAlbumMutation.mutateAsync(album.albumId);

        navigate({
            to: '/p/a/$shortTenantId/$shortShareSecret',
            params: {
                shortTenantId: compactGUID(tenantId),
                shortShareSecret: compactGUID(shareSecret)
            }
        });
    }

    const actionOptions = [
        {
            title: 'Create Public Link',
            onClick: () => navigateToPublicLink(),
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
                        icon: Ellipsis,
                        className: 'text-slate-900',
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

