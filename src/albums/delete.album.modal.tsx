import React from 'react';
import { Modal } from "../common/modal";
import { Album, Item } from '../types';
import { useDeleteAlbum } from '../api/useDeleteAlbum';

interface Props {
    album: Album;
    isOpen: boolean;
    onCancel: Function;
    onDeleteComplete: Function;
}

export const DeleteAlbumModal = ({ album, isOpen, onCancel, onDeleteComplete }: Props) => {
    const deleteAlbumMutation = useDeleteAlbum();

    const handleDelete = async () => {
        await deleteAlbumMutation.mutateAsync(album.albumId);

        onDeleteComplete();
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Delete Album?'
            description='The items in this album will still be available in your gallery.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Delete',
                    color: 'destructive',
                    onClick: handleDelete
                }
            ]}
        />
    );
}
