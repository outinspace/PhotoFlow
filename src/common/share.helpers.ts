import toast from "react-hot-toast";
import { Item } from "../types";

export const downloadFiles = async (items: Item[]) => {
    for (const item of items) {
        const res = await fetch(item.primaryFile.originalUrl);
        if (!res.ok) {
            toast.error(`Could not download ${item.primaryFile.originalFileName}.`);
            continue;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        var link = document.createElement("a");
        link.download = item.primaryFile.originalFileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};


export const shareFiles = async (items: Item[]) => {
    const files: File[] = [];
    for (const item of items) {
        const res = await fetch(item.primaryFile.originalUrl);
        if (!res.ok) {
            toast.error(`Could not share ${item.primaryFile.originalFileName}.`);
            continue;
        }

        const blob = await res.blob();
        const file = new File([blob], item.primaryFile.originalFileName, { type: blob.type });

        files.push(file);
    }

    await navigator.share({
        files
    });
}
