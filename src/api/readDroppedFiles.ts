// Collect every file from a drop, descending into any dropped folders.
//
// DataTransfer.files does NOT expand directories — dropping a folder yields no
// usable File for its contents. The (non-standard but widely supported)
// webkitGetAsEntry() API exposes the FileSystemEntry tree so we can walk it.
//
// The DataTransferItemList is only valid synchronously while the drop event is
// being handled, so entries must be captured before the first await. Call this
// synchronously from the drop handler (do not await anything before it).

// FileSystemEntry / FileSystemDirectoryReader typings aren't uniformly present
// across our lib targets, so these helpers use minimal structural shapes.
type Entry = {
    isFile: boolean;
    isDirectory: boolean;
    file: (onSuccess: (file: File) => void, onError: (err: unknown) => void) => void;
    createReader: () => DirectoryReader;
};

type DirectoryReader = {
    readEntries: (onSuccess: (entries: Entry[]) => void, onError: (err: unknown) => void) => void;
};

const getFile = (entry: Entry): Promise<File> =>
    new Promise((resolve, reject) => entry.file(resolve, reject));

const readEntries = (reader: DirectoryReader): Promise<Entry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

const collectEntry = async (entry: Entry, out: File[]): Promise<void> => {
    if (entry.isFile) {
        out.push(await getFile(entry));
        return;
    }

    if (entry.isDirectory) {
        const reader = entry.createReader();
        // readEntries returns at most 100 entries per call, so loop until it's empty.
        let batch = await readEntries(reader);
        while (batch.length > 0) {
            for (const child of batch) {
                await collectEntry(child, out);
            }
            batch = await readEntries(reader);
        }
    }
};

export const readDroppedFiles = (dataTransfer: DataTransfer): Promise<File[]> => {
    // Capture entries synchronously — the item list is dead once we await.
    const entries = Array.from(dataTransfer.items)
        .map(item => (item as unknown as { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.())
        .filter((entry): entry is Entry => Boolean(entry));

    // No entry API (or nothing droppable as entries) — fall back to the flat list.
    if (entries.length === 0) {
        return Promise.resolve(Array.from(dataTransfer.files));
    }

    return (async () => {
        const out: File[] = [];
        for (const entry of entries) {
            await collectEntry(entry, out);
        }
        return out;
    })();
};
