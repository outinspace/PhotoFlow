import toast from "react-hot-toast";
import { File, Item } from "../types";
import { downloadUrl, mediaUrl } from "../storage/bucket";

// Downloads point straight at the object in storage; there is no server to proxy
// them through. The URL is signed, since the bucket is private, and asks storage to
// answer as an attachment under the original filename — the `download` attribute
// below is ignored for a cross-origin URL, so storage has to say it instead.
export const downloadFile = async (file: File) => {
    const link = document.createElement("a");
    link.href = await downloadUrl(file.originalSource, file.originalFileName);
    link.download = file.originalFileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const downloadFiles = async (items: Item[]) => {
    const loadingToast = toast.loading(`Downloading ${items.length} file${items.length > 1 ? 's' : ''}...`);

    // Spaced out so the browser does not treat a burst of downloads as a popup.
    for (const [index, item] of items.entries()) {
        if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        await downloadFile(item.primaryFile);
    }

    toast.dismiss(loadingToast);
    toast.success(`Downloaded ${items.length} file${items.length > 1 ? 's' : ''}`);
};

export const shareFiles = async (items: Item[]) => {
    const files: globalThis.File[] = [];

    const promises = items.map(async item => {
        const res = await fetch(await mediaUrl(item.primaryFile.originalSource));
        if (!res.ok) {
            toast.error(`Could not download ${item.primaryFile.originalFileName}.`);
            return;
        }

        const blob = await res.blob();
        const file = new globalThis.File([blob], item.primaryFile.originalFileName, { type: blob.type });

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
