import toast from "react-hot-toast";
import { Item } from "../types";
import constants from "../constants";

export const downloadFile = (fileId: string) => {
    const sessionId = localStorage.getItem('sessionId');
    const tenantId = localStorage.getItem('tenantId');
    
    if (!sessionId || !tenantId) {
        console.error('No valid session found');
        return;
    }

    const downloadUrl = `${constants.apiUrl}/files/${fileId}/download?sessionId=${sessionId}&tenantId=${tenantId}`;
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const downloadFiles = async (items: Item[]) => {
    const sessionId = localStorage.getItem('sessionId');
    const tenantId = localStorage.getItem('tenantId');
    
    if (!sessionId || !tenantId) {
        toast.error('No valid session found');
        return;
    }

    // For multiple files, we can't use the direct URL approach with toast.promise
    // since the downloads happen immediately. Instead, we'll trigger them sequentially
    // with a small delay to avoid overwhelming the browser
    
    let successCount = 0;
    let errorCount = 0;
    
    const downloadPromises = items.map(async (item, index) => {
        // Add a small delay between downloads to avoid browser limits
        await new Promise(resolve => setTimeout(resolve, index * 100));
        
        try {
            downloadFile(item.primaryFile.fileId);
            successCount++;
        } catch (error) {
            console.error(`Failed to download ${item.primaryFile.originalFileName}:`, error);
            errorCount++;
        }
    });

    const loadingToast = toast.loading(`Downloading ${items.length} file${items.length > 1 ? 's' : ''}...`);
    
    await Promise.all(downloadPromises);
    
    toast.dismiss(loadingToast);
    
    if (errorCount === 0) {
        toast.success(`Downloaded ${successCount} file${successCount > 1 ? 's' : ''}`);
    } else if (successCount > 0) {
        toast(`Downloaded ${successCount} file${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
    } else {
        toast.error('All downloads failed');
    }
};


export const shareFiles = async (items: Item[]) => {
    const files: File[] = [];

    const promises = items.map(async item => {
        const res = await fetch(item.primaryFile.originalUrl);
        if (!res.ok) {
            toast.error(`Could not download ${item.primaryFile.originalFileName}.`);
            return;
        }

        const blob = await res.blob();
        const file = new File([blob], item.primaryFile.originalFileName, { type: blob.type });

        files.push(file);
    });

    const combinedPromise = Promise.all(promises);

    await toast.promise(combinedPromise, {
        loading: 'Downloading...',
        error: 'Failed to download.',
        success: 'Download Complete'
    });

    const shareData = { files };

    if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
    } else {
        toast.error('Failed to share files.');
    }
}
