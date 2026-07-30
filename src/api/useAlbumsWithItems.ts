import { useMemo } from "react";
import { AlbumWithItems, Item } from "../types";
import { useGallery } from "./useGallery";
import { useAlbums } from "./useAlbums";

export const useAlbumsWithItems = (): AlbumWithItems[] | undefined => {
    const { data: gallery } = useGallery();
    const { data: albums } = useAlbums();

    const albumsWithItems = useMemo(() => {
        if (!gallery || !albums) {
            return;
        }

        // Link items to albums
        const itemsById: Record<string, Item> = {};
        for (const item of gallery.items) {
            itemsById[item.itemId] = item;
        }

        return albums.map(album => ({
            ...album,
            items: album.itemIds
                .map(itemId => itemsById[itemId])
                .filter(item => !!item)
        }));
    }, [gallery, albums]);

    return albumsWithItems;
}

