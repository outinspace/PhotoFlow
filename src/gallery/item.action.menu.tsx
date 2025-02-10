import React, { useMemo, useState } from 'react';
import { Item } from '../types';
import { Book, Download, Link, Minus, Plus, Refresh, Reply, ShareIos, Trash } from 'iconoir-react';
import { Modal } from '../common/modal';
import { useDeleteItems, useRemoveItemsFromAlbum, useReprocessItem, useRestoreItems } from '../queries';
import { AddToAlbumModal } from './add.to.album.modal';
import { CreateAlbumModal } from './create.album.modal';
import { compactGUID } from '../common/format.helpers';
import { ActionMenu } from '../common/action.menu';
import { downloadFiles, shareFiles } from '../common/share.helpers';
import { router } from '../routes';

interface Props {
    items: Item[];
    albumId: number | null;
    isOpen: boolean;
    onDismiss: Function;
    onDeleteCompletion?: Function;
    onActionCompleted?: Function;
    position: 'top' | 'bottom';
}

export const ItemActionMenu = ({ items, albumId, isOpen, onDismiss, onDeleteCompletion, onActionCompleted, position }: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
    const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);

    const deleteItems = useDeleteItems();
    const removeFromAlbumMutation = useRemoveItemsFromAlbum();
    const restoreItemsMutation = useRestoreItems();
    const reprocessItemMutation = useReprocessItem();

    const sharePublicLink = () => {
        const tenantId = localStorage.getItem('tenantId');
        const fileId = items[0]?.primaryFile?.fileId;

        if (!tenantId || !fileId) {
            return;
        }

        const shortTenantId = compactGUID(tenantId);
        const shortFileId = compactGUID(fileId);

        const link = router.buildLocation({
            to: '/p/i/$shortTenantId/$shortPrimaryFileId',
            params: {
                shortTenantId: shortTenantId,
                shortPrimaryFileId: shortFileId
            }
        });

        const url = window.location.origin + link.href;

        if (!!navigator.share) {
            navigator.share({
                url: url
            });
        } else {
            window.open(url, '_blank');
        }
    }

    const handleDelete = async () => {
        const itemIds = items.map(i => i.itemId);
        await deleteItems.mutateAsync(itemIds);

        onDeleteCompletion?.();
        onActionCompleted?.();
    }

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

    const options = [
        {
            title: `Download ${items.length === 1 ? 'File' : 'Files'}`,
            visible: !sharingSupported,
            icon: Download,
            className: '',
            onClick: () => downloadFiles(items)
        },
        {
            title: `Share ${items.length === 1 ? 'File' : 'Files'}`,
            visible: sharingSupported,
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
            title: 'Reprocess',
            visible: items.length === 1,
            icon: Refresh,
            className: '',
            onClick: () => {
                reprocessItemMutation.mutate(items[0].itemId);
                onDismiss();
            }
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
        }
    ]
        .filter(_ => _.visible);

    return (
        <>
            <ActionMenu
                isOpen={showMenu && isOpen}
                onDismiss={onDismiss}
                position={position}
                options={options}
            />
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

