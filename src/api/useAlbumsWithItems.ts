import { useMemo } from "react";
import { AlbumWithItems, Item } from "../types";
import { useItems } from "./useItems";
import { useAlbums } from "./useAlbums";

export const useAlbumsWithItems = (): AlbumWithItems[] | undefined => {
    const { data: items } = useItems();
    const { data: albums } = useAlbums();

    const albumsWithItems = useMemo(() => {
        if (!items || !albums) {
            return;
        }

        // Link items to albums
        const itemsById: Record<string, Item> = {};
        for (const item of items) {
            itemsById[item.itemId] = item;
        }

        return albums.map(album => ({
            ...album,
            items: album.itemIds
                .map(itemId => itemsById[itemId])
                .filter(item => !!item)
        }));
    }, [items, albums]);

    return albumsWithItems;
}

