import { queryClient } from '../app';
import { Item } from '../types';
import { Catalog } from './catalog';
import { MergedState } from './mutations';
import { selectAlbums } from '../api/useAlbums';
import { writeJson } from './bucket';

// A share link has to work for someone with no credentials and no app config, so
// each share is written as a standalone JSON document containing everything the
// page needs. The API used to strip location fields on the way out; here that
// happens when the document is written, which has the same effect and leaves
// nothing sensitive in the object at all.

export interface SharedAlbum {
    name: string;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    items: Item[];
    urls: Catalog['manifest']['urls'];
}

export interface SharedItem {
    item: Item;
    urls: Catalog['manifest']['urls'];
}

export const albumShareKey = (secret: string) => `share/album/${secret}.json`;
export const itemShareKey = (fileId: string) => `share/item/${fileId}.json`;

const withoutLocation = (item: Item): Item => ({
    ...item,
    latitude: null,
    longitude: null,
    altitude: null,
    city: null,
    region: null
});

const readCaches = () => {
    const catalog = queryClient.getQueryData<Catalog>(['catalog']);
    const mutations = queryClient.getQueryData<MergedState>(['mutations']);

    if (!catalog) {
        throw new Error('The library is still loading.');
    }

    return { catalog, mutations };
};

export const publishAlbumShare = async (albumId: number, secret: string) => {
    const { catalog, mutations } = readCaches();

    const album = selectAlbums(mutations).find(candidate => candidate.albumId === albumId);
    if (!album) {
        throw new Error('Album not found.');
    }

    const itemIds = new Set(album.itemIds);
    const items = catalog.items.filter(item => itemIds.has(item.itemId)).map(withoutLocation);

    await writeJson(albumShareKey(secret), {
        name: album.name,
        createdTimeUtc: album.createdTimeUtc,
        updatedTimeUtc: new Date().toISOString(),
        items,
        urls: catalog.manifest.urls
    } satisfies SharedAlbum);
};

export const publishItemShare = async (item: Item) => {
    const { catalog } = readCaches();

    await writeJson(itemShareKey(item.primaryFile.fileId), {
        item: withoutLocation(item),
        urls: catalog.manifest.urls
    } satisfies SharedItem);
};
