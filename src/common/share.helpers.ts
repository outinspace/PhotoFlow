import toast from "react-hot-toast";
import { Item } from "../types";

export const downloadFiles = async (items: Item[]) => {
    const promises = items.map(async item => {
        const res = await fetch(item.primaryFile.originalUrl);
        if (!res.ok) {
            toast.error(`Could not download ${item.primaryFile.originalFileName}.`);
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        var link = document.createElement("a");
        link.download = item.primaryFile.originalFileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    const combinedPromise = Promise.all(promises);

    toast.promise(combinedPromise, {
        loading: 'Downloading...',
        error: 'Failed to download.',
        success: 'Download Complete'
    });
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

    toast.promise(combinedPromise, {
        loading: 'Downloading...',
        error: 'Failed to download.',
        success: 'Download Complete'
    });

    await navigator.share({
        files
    });
}
