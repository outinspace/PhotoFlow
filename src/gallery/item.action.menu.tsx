import { useMemo, useState } from 'react';
import { Item } from '../types';
import { Book, Download, Link, Minus, Plus, Refresh, Reply, ShareIos, Trash } from 'iconoir-react';
import { useRemoveItemsFromAlbum } from '../api/useRemoveItemsFromAlbum';
import { useRestoreItems } from '../api/useRestoreItems';
import { useReprocessItems } from '../api/useReprocessItems';
import { AddToAlbumModal } from './add.to.album.modal';
import { CreateAlbumModal } from './create.album.modal';
import { ActionMenu } from '../common/action.menu';
import { downloadFiles, shareFiles } from '../common/share.helpers';
import { buildShareUrl, publishItemShare } from '../storage/sharing';
import { DeleteItemsModal } from './delete.items.modal';
import { IS_STANDALONE } from '../common/browser.utils';

interface Props {
    items: Item[];
    albumId: number | null;
    isOpen: boolean;
    onDismiss: Function;
    // Fired when the items are no longer part of the list being viewed, so a caller
    // showing that list can stop showing them.
    onItemsRemoved?: () => void;
    // Fired after any action finishes, removal or not.
    onActionCompleted?: () => void;
    position: 'top' | 'bottom';
    readonly: boolean;
}

export const ItemActionMenu = ({ items, albumId, isOpen, onDismiss, onItemsRemoved, onActionCompleted, position, readonly }: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
    const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);

    const removeFromAlbumMutation = useRemoveItemsFromAlbum();
    const restoreItemsMutation = useRestoreItems();
    const reprocessMutation = useReprocessItems();

    const getPublicUrl = async () => {
        const item = items[0];
        if (!item?.primaryFile) {
            return;
        }

        // Publishing writes the standalone share document and hands back a
        // presigned URL for it; without that the link would resolve to nothing
        // for anyone but the owner.
        return buildShareUrl('/p/i', await publishItemShare(item));
    }

    const sharePublicLink = async () => {
        const url = await getPublicUrl();
        if (!url) {
            return;
        }
        navigator.share({ url });
    }

    const openPublicLink = async () => {
        const url = await getPublicUrl();
        if (url) {
            window.open(url, '_blank');
        }
    }

    const handleItemsRemoved = () => {
        onItemsRemoved?.();
        onActionCompleted?.();
    }

    const removeItemsFromAlbum = () => {
        if (!albumId) {
            return;
        }

        const itemIds = items.map(i => i.itemId);
        removeFromAlbumMutation.mutate({ albumId, itemIds }, {
            onSuccess: handleItemsRemoved
        });
    }

    const restoreItems = () => {
        const itemIds = items.map(i => i.itemId);
        restoreItemsMutation.mutate(itemIds, {
            onSuccess: handleItemsRemoved
        });
    }

    const showMenu = !showDeleteModal && !showAddToAlbumModal && !showCreateAlbumModal;

    const itemsAreDeleted = useMemo(() => items.every(item => item.deletedTimeUtc !== null), [items]);

    const showSharingOptions = !!navigator.share && !!navigator.canShare && IS_STANDALONE;

    const options = [
        {
            title: `Download ${items.length === 1 ? 'File' : 'Files'}`,
            visible: !showSharingOptions,
            icon: Download,
            className: '',
            onClick: () => downloadFiles(items)
        },
        {
            title: `Share ${items.length === 1 ? 'File' : 'Files'}`,
            visible: showSharingOptions,
            icon: ShareIos,
            className: '',
            onClick: () => shareFiles(items)
        },
        {
            title: `Share Public Link`,
            visible: items.length === 1 && !readonly && showSharingOptions,
            icon: Link,
            className: '',
            onClick: () => sharePublicLink()
        },
        {
            title: `Open Public Link`,
            visible: items.length === 1 && !readonly && !showSharingOptions,
            icon: Link,
            className: '',
            onClick: () => openPublicLink()
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
            visible: !itemsAreDeleted && !readonly,
            icon: Refresh,
            className: '',
            onClick: () => {
                reprocessMutation.mutate(items.flatMap(item => item.files));
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
                    handleItemsRemoved();
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

