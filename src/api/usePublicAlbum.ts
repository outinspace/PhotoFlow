import { useQuery } from "@tanstack/react-query";
import { computeItemProperties } from "./computeItemProperties";
import { readJson } from "../storage/bucket";
import { retryUnlessRefused } from "./retryUnlessRefused";
import { SharedAlbum } from "../storage/sharing";

export const usePublicAlbum = (documentUrl: string) => useQuery({
    queryKey: ['public', 'album', documentUrl],
    retry: retryUnlessRefused,
    queryFn: async () => {
        const album = await readJson<SharedAlbum>(documentUrl);
        if (!album) {
            throw new Error('This shared album is no longer available.');
        }

        for (const item of album.items) {
            computeItemProperties(item);
        }

        return album;
    }
});
