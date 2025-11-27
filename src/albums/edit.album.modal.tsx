import { useState } from 'react';
import { Modal } from "../common/modal";
import { Album } from '../types';
import { useUpdateAlbum } from '../api/useUpdateAlbum';

interface Props {
    album: Album;
    isOpen: boolean;
    onCancel: Function;
    onEditComplete: Function;
}

export const EditAlbumModal = ({ album, isOpen, onCancel, onEditComplete }: Props) => {
    const updateAlbumMutation = useUpdateAlbum();
    const [albumName, setAlbumName] = useState(album.name);

    const handleUpdate = async () => {
        await updateAlbumMutation.mutateAsync({
            albumId: album.albumId,
            name: albumName
        });

        onEditComplete();
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Edit Album'
            description='Give the album a new name.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Save',
                    color: 'primary',
                    onClick: handleUpdate,
                    disabled: albumName === album.name || albumName === ''
                }
            ]}
        >
            <input
                type='text'
                placeholder='Album Name'
                value={albumName}
                onChange={e => setAlbumName(e.target.value)}
                className='flex-auto border rounded bg-slate-100 p-2 hover:bg-slate-200'
                maxLength={50}
            />
        </Modal>
    );
}
