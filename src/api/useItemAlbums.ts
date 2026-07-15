import { useMemo } from "react";
import { Album } from "../types";
import { useAlbums } from "./useAlbums";

export const useItemAlbumsMap = (enabled: boolean = true): Record<number, Album[]> | undefined => {
    const { data: albums } = useAlbums(enabled);

    return useMemo(() => {
        if (!albums) {
            return undefined;
        }

        const map: Record<number, Album[]> = {};
        for (const album of albums) {
            for (const itemId of album.itemIds) {
                (map[itemId] ??= []).push(album);
            }
        }

        return map;
    }, [albums]);
};
