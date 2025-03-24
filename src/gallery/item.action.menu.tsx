import React, { useMemo, useState } from 'react';
import { Item } from '../types';
import { Book, Download, Link, Minus, Plus, Refresh, Reply, ShareIos, Trash } from 'iconoir-react';
import { Modal } from '../common/modal';
import { useRemoveItemsFromAlbum, useReprocessItem, useRestoreItems } from '../queries';
import { AddToAlbumModal } from './add.to.album.modal';
import { CreateAlbumModal } from './create.album.modal';
import { compactGUID } from '../common/format.helpers';
import { ActionMenu } from '../common/action.menu';
import { downloadFiles, shareFiles } from '../common/share.helpers';
import { router } from '../routes';
import { DeleteItemsModal } from './delete.items.modal';

interface Props {
    items: Item[];
    albumId: number | null;
    isOpen: boolean;
    onDismiss: Function;
    onDeleteCompletion?: Function;
    onActionCompleted?: Function;
    position: 'top' | 'bottom';
    readonly: boolean;
}

export const ItemActionMenu = ({ items, albumId, isOpen, onDismiss, onDeleteCompletion, onActionCompleted, position, readonly }: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
    const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);

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

    const sharingSupported = !!navigator.share && !!navigator.canShare;

    const options = [
        {
            title: `Download ${items.length === 1 ? 'File' : 'Files'}`,
            visible: true,
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
            visible: items.length === 1 && !readonly,
            icon: Link,
            className: '',
            onClick: () => sharePublicLink()
        },
        {
            title: 'Create New Album',
            visible: !itemsAreDeleted && !readonly,
            icon: Book,
            className: '',
            onClick: () => setShowCreateAlbumModal(true)
        },
        {
            title: 'Add To Album',
            visible: !itemsAreDeleted && !readonly,
            icon: Plus,
            className: '',
            onClick: () => setShowAddToAlbumModal(true)
        },
        {
            title: 'Remove From Album',
            visible: albumId && !itemsAreDeleted && !readonly,
            icon: Minus,
            className: '',
            onClick: () => removeItemsFromAlbum()
        },
        {
            title: 'Reprocess',
            visible: items.length === 1 && !readonly,
            icon: Refresh,
            className: '',
            onClick: () => {
                reprocessItemMutation.mutate(items[0].itemId);
                onDismiss();
            }
        },
        {
            title: 'Delete',
            visible: !itemsAreDeleted && !readonly,
            icon: Trash,
            className: 'text-red-500',
            onClick: () => setShowDeleteModal(true)
        },
        {
            title: 'Restore',
            visible: itemsAreDeleted && !readonly,
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
            <DeleteItemsModal
                isOpen={showDeleteModal}
                onCancel={() => {
                    setShowDeleteModal(false);
                    onDismiss();
                }}
                onDeleteComplete={() => {
                    setShowDeleteModal(false);
                    onDeleteCompletion?.();
                    onActionCompleted?.();
                }}
                items={items}
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

