import React, { useState } from 'react';
import { Item } from '../types';
import { Menu } from 'iconoir-react';
import { Modal } from '../common/modal';
import { useDeleteItem } from '../queries';

interface Props {
    items: Item[];
    onDeleteCompletion?: Function;
}

export const ItemActionMenu = ({ items, onDeleteCompletion }: Props) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAlbumModal, setShowAlbumModal] = useState(false);

    const deleteItem = useDeleteItem();

    const optionClasses = 'border-b last:border-none border-slate-200 p-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 first:rounded-t last:rounded-b';

    const isSingleDeletedItem = items.length === 1 && items[0].deletedTimeUtc !== null;

    const openDeleteModal = () => {
        setShowMenu(false);
        setShowDeleteModal(true);
    }

    const openAlbumModal = () => {
        setShowMenu(false);
        setShowAlbumModal(true);
    }

    const handleDelete = async () => {
        // TODO: Optimize
        for (const item of items) {
            await deleteItem.mutateAsync(item.itemId);
        }
        onDeleteCompletion?.();
    }

    // TODO: Icons
    return (
        <>
            <Menu
                className='h-8 w-8'
                onClick={() => setShowMenu(!showMenu)}
            />
            {showMenu && (
                <>
                    <div className='fixed top-0 bottom-0 left-0 right-0' onClick={() => setShowMenu(false)}/>
                    <div className='absolute min-w-40 right-0 text-black mt-10 mr-5 drop-shadow'>
                        <div
                            className={optionClasses}
                            onClick={openAlbumModal}
                        >
                            Add To Album
                        </div>
                        {isSingleDeletedItem ? (
                            <div
                                className={optionClasses + ' text-sky-500'}
                            >
                                Restore
                            </div>
                        ) : (
                            <div
                                className={optionClasses + ' text-red-500'}
                                onClick={openDeleteModal}
                            >
                                Delete
                            </div>
                        )}
                    </div>
                </>
            )}
            <Modal
                isOpen={showDeleteModal}
                title='Mark For Deletion?'
                description='This item will be accessible in Recently Deleted Items for 30 days.'
                actions={[
                    {
                        text: 'Cancel',
                        color: 'neutral',
                        onClick: () => setShowDeleteModal(false)
                    },
                    {
                        text: 'Delete',
                        color: 'destructive',
                        onClick: handleDelete
                    }
                ]}
            />
            <Modal
                isOpen={showAlbumModal}
                title='Add To Album'
                description='TODO'
                actions={[
                    {
                        text: 'Cancel',
                        color: 'neutral',
                        onClick: () => setShowAlbumModal(false)
                    },
                    {
                        text: 'Add To Album',
                        color: 'primary',
                        onClick: () => alert('TODO')
                    }
                ]}
            />
        </>
    );
};

