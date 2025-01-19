import React, { useMemo, useState } from 'react';
import { Item } from '../types';
import { Book, Download, Link, Minus, Plus, Refresh, Reply, ShareIos, Trash } from 'iconoir-react';
import { Modal } from '../common/modal';
import { fetchAuthenticatedRoute, useDeleteItems, useRemoveItemsFromAlbum, useRestoreItems } from '../queries';
import { AddToAlbumModal } from './add.to.album.modal';
import { useDebugMode } from '../hooks/use.debug.mode';
import { CreateAlbumModal } from './create.album.modal';
import { useLinkProps, useNavigate, useSearch } from '@tanstack/react-router';
import { compactGUID } from '../common/format.helpers';
import { ActionMenu } from '../common/action.menu';
import toast from 'react-hot-toast';
import { downloadFiles, shareFiles } from '../common/share.helpers';

interface Props {
    items: Item[];
    albumId: number | null;
    onDismiss: Function;
    onDeleteCompletion?: Function;
    onActionCompleted?: Function;
    position: 'top' | 'bottom';
}

export const ItemActionMenu = ({ items, albumId, onDismiss, onDeleteCompletion, onActionCompleted, position }: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
    const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
    const showDebugOptions = useDebugMode();

    const deleteItems = useDeleteItems();
    const removeFromAlbumMutation = useRemoveItemsFromAlbum();
    const restoreItemsMutation = useRestoreItems();

    // TODO: Extract
    const shortTenantId = compactGUID(localStorage.getItem('tenantId') ?? '');
    const shortFileId = compactGUID(items[0]?.primaryFile?.fileId ?? '');

    const { href: itemPublicLinkPath } = useLinkProps({
        to: '/p/i/$shortTenantId/$shortPrimaryFileId',
        params: {
            shortTenantId: shortTenantId,
            shortPrimaryFileId: shortFileId
        }
    });

    const sharePublicLink = () => {
        if (!shortTenantId || !shortFileId || !itemPublicLinkPath) {
            return;
        }

        const href = window.location.origin + '/' + itemPublicLinkPath;

        if (!!navigator.share) {
            navigator.share({
                url: href
            });
        } else {
            window.open(href, '_blank');
        }
    }

    const handleDelete = async () => {
        const itemIds = items.map(i => i.itemId);
        await deleteItems.mutateAsync(itemIds);

        onDeleteCompletion?.();
        onActionCompleted?.();
    }

    const reprocessItems = async () => {
        for (const item of items) {
            for (const file of item.files) {
                const res = await fetchAuthenticatedRoute(`/debug/reprocess-file?fileId=${file.fileId}`, {
                    method: 'POST'
                });

                console.log('Reprocess Result: ', item.itemId, file.fileId, res.statusText);
            }
        }
    };

    const removeItemsFromAlbum = async () => {
        if (!albumId) {
            return;
        }

        const itemIds = items.map(i => i.itemId);
        await removeFromAlbumMutation.mutateAsync({ albumId, itemIds });

        onDeleteCompletion?.();
        onActionCompleted?.();
    }

    const restoreItems = async () => {
        const itemIds = items.map(i => i.itemId);
        await restoreItemsMutation.mutateAsync(itemIds);

        onActionCompleted?.();
    }

    const showMenu = !showDeleteModal && !showAddToAlbumModal && !showCreateAlbumModal;

    const itemsAreDeleted = useMemo(() => items.every(item => item.deletedTimeUtc !== null), [items]);

    const sharingSupported = !!navigator.share;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    const options = [
        {
            title: `Download ${items.length === 1 ? 'File' : 'Files'}`,
            visible: !isPWA,
            icon: Download,
            className: '',
            onClick: () => downloadFiles(items)
        },
        {
            title: `Share ${items.length === 1 ? 'File' : 'Files'}`,
            visible: isPWA,
            icon: ShareIos,
            className: '',
            onClick: () => shareFiles(items)
        },
        {
            title: `${sharingSupported ? 'Share' : 'Open'} Public Link`,
            visible: items.length === 1,
            icon: Link,
            className: '',
            onClick: () => sharePublicLink()
        },
        {
            title: 'Create New Album',
            visible: !itemsAreDeleted,
            icon: Book,
            className: '',
            onClick: () => setShowCreateAlbumModal(true)
        },
        {
            title: 'Add To Album',
            visible: !itemsAreDeleted,
            icon: Plus,
            className: '',
            onClick: () => setShowAddToAlbumModal(true)
        },
        {
            title: 'Remove From Album',
            visible: albumId && !itemsAreDeleted,
            icon: Minus,
            className: '',
            onClick: () => removeItemsFromAlbum()
        },
        {
            title: 'Delete',
            visible: !itemsAreDeleted,
            icon: Trash,
            className: 'text-red-500',
            onClick: () => setShowDeleteModal(true)
        },
        {
            title: 'Restore',
            visible: itemsAreDeleted,
            icon: Reply,
            className: 'text-sky-500',
            onClick: () => restoreItems()
        },
        {
            title: 'Reprocess',
            visible: showDebugOptions,
            icon: Refresh,
            className: '',
            onClick: () => reprocessItems()
        }
    ]
        .filter(_ => _.visible);

    return (
        <>
            {showMenu && (
                <ActionMenu
                    onDismiss={onDismiss}
                    position={position}
                    options={options}
                />
            )}
            <Modal
                isOpen={showDeleteModal}
                title='Mark For Deletion?'
                description='This item will be accessible in Recently Deleted Items for 30 days.'
                actions={[
                    {
                        text: 'Cancel',
                        color: 'neutral',
                        onClick: () => {
                            setShowDeleteModal(false);
                            onDismiss();
                        }
                    },
                    {
                        text: 'Delete',
                        color: 'destructive',
                        onClick: handleDelete
                    }
                ]}
            />
            <AddToAlbumModal
                isOpen={showAddToAlbumModal}
                items={items}
                onCancel={() => {
                    setShowAddToAlbumModal(false);
                    onDismiss(true);
                }}
                onAddComplete={() => {
                    setShowAddToAlbumModal(false);
                    onActionCompleted?.();
                }}
            />
            <CreateAlbumModal
                isOpen={showCreateAlbumModal}
                items={items}
                onCancel={() => {
                    setShowCreateAlbumModal(false);
                    onDismiss(true);
                }}
                onAddComplete={() => {
                    setShowCreateAlbumModal(false);
                    onActionCompleted?.();
                }}
            />
        </>
    );
};

