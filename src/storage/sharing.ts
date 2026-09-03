import { queryClient } from '../app';
import { Item } from '../types';
import { Catalog } from './catalog';
import { MergedState } from './mutations';
import { selectAlbums } from '../api/useAlbums';
import { downloadUrl, mediaUrl, writeJson } from './bucket';

// A share link has to work for someone with no credentials and no app config, so
// each share is written as a standalone JSON document containing everything the
// page needs.
//
// The bucket is private, so that document also has to carry working URLs rather
// than bucket keys: its reader has nothing to sign with. Every URL in it, and the
// link to the document itself, is presigned at the moment of sharing. SigV4 will
// not sign for longer than seven days, so a link stops working after a week and
// re-sharing issues a fresh one.
//
// Revoking early means deleting the document, or deleting the application key,
// which invalidates every URL ever signed with it.

export interface SharedAlbum {
    name: string;
    createdTimeUtc: string;
    updatedTimeUtc: string;
    items: Item[];
}

export interface SharedItem {
    item: Item;
}

export const albumShareKey = (secret: string) => `share/album/${secret}.json`;
export const itemShareKey = (fileId: string) => `share/item/${fileId}.json`;

// Replaces every bucket key in an item with a presigned URL, so the page can load
// its media without signing anything.
//
// The original is included, signed to download under its own filename, and the
// item's location is kept: sharing means handing over the photo, and a photo's
// location and full-resolution file are part of it. Anyone who would rather not
// share those should not share the photo. What a recipient cannot do is reach
// anything outside the document: each URL is good for exactly one object, and a
// key by itself opens nothing.
const withSignedMedia = async (item: Item): Promise<Item> => {
    const files = await Promise.all(item.files.map(async file => ({
        ...file,
        tileImageSource: file.tileImageSource ? await mediaUrl(file.tileImageSource) : null,
        previewSource: file.previewSource ? await mediaUrl(file.previewSource) : null,
        originalSource: await downloadUrl(file.originalSource, file.originalFileName)
    })));

    return { ...item, files };
};

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
    const items = await Promise.all(
        catalog.items.filter(item => itemIds.has(item.itemId)).map(withSignedMedia)
    );

    const key = albumShareKey(secret);

    await writeJson(key, {
        name: album.name,
        createdTimeUtc: album.createdTimeUtc,
        updatedTimeUtc: new Date().toISOString(),
        items
    } satisfies SharedAlbum);

    return await mediaUrl(key);
};

export const publishItemShare = async (item: Item) => {
    const key = itemShareKey(item.primaryFile.fileId);

    await writeJson(key, {
        item: await withSignedMedia(item)
    } satisfies SharedItem);

    return await mediaUrl(key);
};

const FRAGMENT_KEY = 'd';

// The document's URL is presigned, which makes it the credential that opens the
// share. It travels in the fragment, which browsers never send to a server, so it
// cannot turn up in this app's access logs or in a CDN's.
export const buildShareUrl = (path: '/p/i' | '/p/a', documentUrl: string) =>
    `${window.location.origin}${path}#${new URLSearchParams({ [FRAGMENT_KEY]: documentUrl })}`;

export const readSharedDocumentUrl = (): string | null =>
    new URLSearchParams(window.location.hash.replace(/^#/, '')).get(FRAGMENT_KEY);
