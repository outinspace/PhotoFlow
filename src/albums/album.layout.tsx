import { useMemo, useState } from 'react';
import { useAlbumsWithItems } from "../api/useAlbumsWithItems";
import { buildShareUrl } from '../storage/sharing';
import { useShareAlbum } from "../api/useShareAlbum";
import ItemGrid from '../gallery/item.grid';
import { TopBar } from '../common/top.bar';
import { useNavigate, useParams } from '@tanstack/react-router';
import { EditPencil, Link, ShareIos, Trash } from 'iconoir-react';
import { DeleteAlbumModal } from './delete.album.modal';
import { EditAlbumModal } from './edit.album.modal';
import { ActionMenu } from '../common/action.menu';
import { Ellipsis } from '../common/ellipsis';
import toast from 'react-hot-toast';

export const AlbumLayout = () => {
    const navigate = useNavigate();
    const shareAlbumMutation = useShareAlbum();
    const { albumId } = useParams({ from: '/album/$albumId' });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [actionMenuActive, setActionMenuActive] = useState(false);

    const albumIdNumber = parseInt(albumId);
    if (isNaN(albumIdNumber)) {
        throw new Error('Invalid album ID');
    }

    const albums = useAlbumsWithItems() ?? [];
    const album = useMemo(() => {
        return albums.find(_ => _.albumId === albumIdNumber)
    }, [albums, albumIdNumber])

    if (!album) {
        return;
    }

    const getPublicLink = async () => {
        const documentUrl = await shareAlbumMutation.mutateAsync(album.albumId).catch(() => null);
        if (!documentUrl) {
            return;
        }

        return buildShareUrl('/p/a', documentUrl);
    }

    const sharePublicLink = async () => {
        const url = await getPublicLink();
        if (!url) {
            return;
        }

        if (!!navigator.share) {
            navigator.share({ url });
        } else {
            toast.error('Your Web Browser does not support sharing.');
        }
    }

    const openPublicLink = async () => {
        const url = await getPublicLink();
        if (!url) {
            return;
        }

        window.open(url, '_blank');
    }

    const sharingSupported = !!navigator.share;

    let actionOptions = [
        {
            title: 'Open Public Link',
            onClick: () => openPublicLink(),
            visible: true,
            icon: Link
        },
        {
            title: 'Share Public Link',
            onClick: () => sharePublicLink(),
            visible: sharingSupported,
            icon: ShareIos
        },
        {
            title: 'Edit',
            onClick: () => setShowEditModal(true),
            visible: true,
            icon: EditPencil
        },
        {
            title: 'Delete',
            onClick: () => setShowDeleteModal(true),
            icon: Trash,
            visible: true,
            className: 'text-red-500'
        },
    ];

    actionOptions = actionOptions.filter(_ => _.visible);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={album.name}
                rightButtons={[
                    {
                        icon: Ellipsis,
                        className: 'text-slate-900',
                        onClick: () => setActionMenuActive(true),
                        children: (
                            <ActionMenu
                                isOpen={actionMenuActive}
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
            <ItemGrid items={album.items} albumId={albumIdNumber} enableUrlPersistence />
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

