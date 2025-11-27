import { useRef } from 'react';
import { uploadFiles } from '../api/uploadFiles';
import { CloudUpload } from 'iconoir-react';

const UploadButton = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openFileBrowser = () => {
        fileInputRef.current?.click();
    }

    return (
        <div>
            <input
                type='file'
                accept='image/*,video/*'
                multiple
                ref={fileInputRef}
                onChange={e => uploadFiles(e.target.files!)}
                style={{ display: 'none' }}
            />
            <div className='rounded-full bg-slate-100 p-2 hover:bg-slate-200 active:bg-slate-300'>
                <CloudUpload
                    className='size-6'
                    onClick={openFileBrowser}
                />
            </div>
        </div>
    );
};

export default UploadButton;

