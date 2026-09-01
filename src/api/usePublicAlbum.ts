import { useQuery } from "@tanstack/react-query";
import { computeItemProperties } from "./computeItemProperties";
import { readJson } from "../storage/bucket";
import { loadRuntimeConfig } from "../storage/runtime.config";
import { albumShareKey, SharedAlbum } from "../storage/sharing";

export const usePublicAlbum = (shareSecret: string) => useQuery({
    queryKey: ['public', 'album', shareSecret],
    queryFn: async () => {
        await loadRuntimeConfig();

        const album = await readJson<SharedAlbum>(albumShareKey(shareSecret));
        if (!album) {
            throw new Error('This shared album is no longer available.');
        }

        for (const item of album.items) {
            computeItemProperties(item, album.urls.originalPrefix, album.urls.tileImagePrefix, album.urls.previewPrefix);
        }

        return album;
    }
});
