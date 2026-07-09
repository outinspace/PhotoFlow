import { ChangeEvent, useRef, useState } from 'react';
import { enqueueFiles } from '../api/uploadManager';
import { CloudUpload, Folder, MediaImage } from 'iconoir-react';
import { ActionMenu } from '../common/action.menu';

const UploadButton = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            enqueueFiles(e.target.files);
        }
        e.target.value = '';
    };

    return (
        <div className='relative'>
            <input
                type='file'
                accept='image/*,video/*'
                multiple
                ref={fileInputRef}
                onChange={onInputChange}
                style={{ display: 'none' }}
            />
            <input
                type='file'
                multiple
                ref={folderInputRef}
                onChange={onInputChange}
                style={{ display: 'none' }}
                {...({ webkitdirectory: '' } as object)}
            />
            <div className='rounded-full bg-slate-100 p-2 hover:bg-slate-200 active:bg-slate-300'>
                <CloudUpload
                    className='size-6'
                    onClick={() => setIsMenuOpen(true)}
                />
            </div>
            <ActionMenu
                isOpen={isMenuOpen}
                onDismiss={() => setIsMenuOpen(false)}
                onActionStarted={() => setIsMenuOpen(false)}
                position='bottom'
                options={[
                    {
                        title: 'Upload Photos',
                        icon: MediaImage,
                        onClick: () => fileInputRef.current?.click()
                    },
                    {
                        title: 'Upload Folder',
                        icon: Folder,
                        onClick: () => folderInputRef.current?.click()
                    }
                ]}
            />
        </div>
    );
};

export default UploadButton;
