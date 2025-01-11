import React, { useMemo, useState } from 'react';
import { Item } from '../types';
import { Book, CircleSpark, Minus, Plus, Refresh, Reply, Spark, Spiral, Trash } from 'iconoir-react';
import { Modal } from '../common/modal';
import { fetchAuthenticatedRoute, useDeleteItems, useRemoveItemsFromAlbum, useRestoreItems } from '../queries';
import { AddToAlbumModal } from './add.to.album.modal';
import { useDebugMode } from '../hooks/use.debug.mode';
import { CreateAlbumModal } from './create.album.modal';

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

    const optionClasses = 'border-b last:border-none border-slate-200 p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 first:rounded-t last:rounded-b flex items-center';

    const showMenu = !showDeleteModal && !showAddToAlbumModal;

    const itemsAreDeleted = useMemo(() => items.every(item => item.deletedTimeUtc !== null), [items]);

    const options = [
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
    ];

    return (
        <>
            {showMenu && <>
                <div
                    className='absolute bg-slate-500/50 top-0 bottom-0 left-0 right-0'
                    style={{ width: '10000px', height: '10000px', marginLeft: '-5000px', marginTop: '-5000px' }}
                    onClick={() => onDismiss()}
                />
                <div
                    className={`absolute text-nowrap min-w-40 right-0 text-black mr-2 drop-shadow my-12`}
                    style={{
                        bottom: position === 'top' ? 0 : undefined,
                        top: position === 'bottom' ? 0 : undefined
                    }}
                >
                    {options
                        .filter(option => option.visible)
                        .map(option => (
                            <div
                                key={option.title}
                                className={`${optionClasses} ${option.className}`}
                                onClick={() => option.onClick()}
                            >
                                <option.icon className='size-5 ml-1 mr-2' />
                                {option.title}
                            </div>
                        ))}
                </div>
            </>}
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

