import { ReactNode } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { enqueueFiles } from '../api/uploadManager';
import { readDroppedFiles } from '../api/readDroppedFiles';

interface Props {
    children: ReactNode;
    className: string;
}

export const UploadDropZone = ({ children, className }: Props) => {
    const [isActive, setIsActive] = useState(false);
    const dragCounter = useRef(0);

    if (isActive) {
        className = className + ' border-8 border-sky-500';
    }

    return (
        <div
            className={className}
            onDragEnter={() => {
                dragCounter.current++;
                if (dragCounter.current > 0) {
                    setIsActive(true);
                }
            }}
            onDragLeave={() => {
                dragCounter.current--;
                if (dragCounter.current === 0) {
                    setIsActive(false);
                }
            }}
            onDrop={e => {
                e.preventDefault();

                dragCounter.current = 0;
                setIsActive(false);

                // Must read the item list synchronously (before any await) — it
                // is only valid during the drop event. Folders are expanded.
                readDroppedFiles(e.dataTransfer).then(files => {
                    if (files.length > 0) {
                        enqueueFiles(files);
                    }
                });
            }}
            onDragOver={e => e.preventDefault()}
        >
            {children}
        </div>
    );
}
