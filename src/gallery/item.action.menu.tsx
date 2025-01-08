import React, { useState } from 'react';
import { Item } from '../types';
import { Book, Reply, Trash } from 'iconoir-react';
import { Modal } from '../common/modal';
import { useDeleteItems } from '../queries';
import { AddToAlbumModal } from './add.to.album.modal';

interface Props {
    items: Item[];
    onDismiss: Function;
    onDeleteCompletion?: Function;
    onActionCompleted?: Function;
    offsetTop: number;
}

export const ItemActionMenu = ({ items, onDismiss, onDeleteCompletion, onActionCompleted, offsetTop }: Props) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAlbumModal, setShowAlbumModal] = useState(false);

    const deleteItems = useDeleteItems();

    const isSingleDeletedItem = items.length === 1 && items[0].deletedTimeUtc !== null;

    const handleDelete = async () => {
        const itemIds = items.map(i => i.itemId);
        await deleteItems.mutateAsync(itemIds);

        onDeleteCompletion?.();
        onActionCompleted?.();
    }

    const optionClasses = 'border-b last:border-none border-slate-200 p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 first:rounded-t last:rounded-b flex items-center';

    const showMenu = !showDeleteModal && !showAlbumModal;

    return (
        <>
            {showMenu && <>
                <div
                    className='absolute bg-slate-500/50 top-0 bottom-0 left-0 right-0'
                    style={{ width: '10000px', height: '10000px', marginLeft: '-5000px', marginTop: '-5000px' }}
                    onClick={() => onDismiss()}
                />
                <div className={`absolute min-w-40 right-0 text-black mr-2 drop-shadow`} style={{ marginTop: offsetTop }}>
                    {isSingleDeletedItem ? (
                        <div
                            className={optionClasses + ' text-sky-500'}
                        >
                            <Reply className='size-5 ml-1 mr-2' />
                            Restore
                        </div>
                    ) : (
                        <>
                            <div
                                className={optionClasses}
                                onClick={() => setShowAlbumModal(true)}
                            >
                                <Book className='size-5 ml-1 mr-2' />
                                Add To Album
                            </div>
                            <div
                                className={optionClasses + ' text-red-500'}
                                onClick={() => setShowDeleteModal(true)}
                            >
                                <Trash className='size-5 ml-1 mr-2' />
                                Delete
                            </div>
                        </>
                    )}
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
                isOpen={showAlbumModal}
                items={items}
                onCancel={() => {
                    setShowAlbumModal(false);
                    onDismiss(true);
                }}
                onAddComplete={() => {
                    setShowAlbumModal(false);
                    onActionCompleted?.();
                }}
            />
        </>
    );
};

