import { ChangeEvent, useRef, useState } from 'react';
import { enqueueFiles } from '../api/uploadManager';
import { CloudUpload, Folder, MediaImage } from 'iconoir-react';
import { ActionMenu } from '../common/action.menu';

const UploadButton = ({ variant = 'circle' }: { variant?: 'circle' | 'sidebar' }) => {
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
            {variant === 'sidebar' ? (
                <button
                    type='button'
                    className='flex w-full h-11 items-center justify-center gap-2 rounded-full bg-slate-900 text-white text-[15px] font-semibold shadow-md hover:bg-slate-800 cursor-pointer'
                    onClick={() => setIsMenuOpen(true)}
                >
                    <CloudUpload className='size-5' />
                    Upload
                </button>
            ) : (
                <button
                    type='button'
                    aria-label='Upload'
                    title='Upload'
                    className='glass flex size-11 items-center justify-center rounded-full cursor-pointer'
                    onClick={() => setIsMenuOpen(true)}
                >
                    <CloudUpload className='size-6' />
                </button>
            )}
            <ActionMenu
                isOpen={isMenuOpen}
                onDismiss={() => setIsMenuOpen(false)}
                onActionStarted={() => setIsMenuOpen(false)}
                position={variant === 'sidebar' ? 'top' : 'bottom'}
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
