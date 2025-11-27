import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import toast from "react-hot-toast";

const isFileAlreadyImported = async (hash: string) => {
    const res = await fetchAuthenticatedRoute(`/import/files/${hash}`);

    const body = await res.json();
    return body.exists;
}

export const uploadFiles = async (files: FileList) => {
    const tenantId = localStorage.getItem('tenantId') ?? '';

    let loadingToastId: string | undefined = undefined;
    let failureCount = 0;

    let uploadNumber = 1;
    for (const file of files) {
        loadingToastId = toast.loading(`Uploading ${uploadNumber++}/${files.length} files`, {
            id: loadingToastId
        });

        // Check the file hash before uploading, if the crypto API is available.
        if (crypto.subtle) {
            const fileBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const fileAlreadyImported = await isFileAlreadyImported(hashHex);

            if (fileAlreadyImported) {
                continue;
            }
        }

        const formData = new FormData();
        formData.append('file', file);

        // iOS uses the same filename for multiple images when selecting from camera roll.
        // Adding a timestamp ensures unique filenames and prevents conflicts with existing files.
        const timestamp = new Date().getTime();
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        const fileNameWithTimestamp = `${file.name.replace(/\.[^/.]+$/, '')}_${timestamp}${fileExtension}`;

        const res = await fetchAuthenticatedRoute(`/import/s3/${tenantId}/${fileNameWithTimestamp}`, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type
            },
            body: formData.get('file')
        });

        if (!res.ok) {
            toast.error(`Failed to upload ${file.name}`);
            failureCount++;
        }
    }

    if (loadingToastId) {
        toast.dismiss(loadingToastId);
    }

    if (failureCount === 0) {
        toast.success(`${files.length} files uploaded`, {
            duration: Infinity
        });
    } else {
        toast.error(`${failureCount}/${files.length} files failed to upload`, {
            duration: Infinity
        });
    }

    queryClient.invalidateQueries({ queryKey: ['gallery'] });
}

