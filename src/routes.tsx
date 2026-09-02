import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import Gallery from "./gallery/gallery";
import Connect from "./setup/connect";
import LinkDevice from "./setup/link.device";
import Albums from './albums/albums';
import Search from './search/search';
import Menu from './menu/menu';

import { RecentlyDeletedItems } from './menu/recently.deleted.items';
import Settings from './menu/settings';
import StorageSettings from './menu/storage.settings';
import { AlbumLayout } from './albums/album.layout';
import { FailedItems } from './menu/failed.items';
import { PublicItemLayout } from './gallery/public.item.layout';
import { PublicAlbumLayout } from './albums/public.album.layout';
import { NavigationLayout } from "./navigation.layout";
import MemoriesLayout from "./memories/memories.layout";
import { TripLayout } from "./memories/trip.layout";
import { YearLayout } from "./memories/year.layout";
import { getDefaultToMemories } from "./hooks/use.settings";
import { isConfigured } from "./storage/config";
// maplibre-gl is by far the largest dependency here and only the map needs it,
// so it is kept out of the initial bundle.
const Map = lazy(() => import('./map/map'));

export const rootRoute = createRootRoute();

export const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad: () => {
        if (!isConfigured()) {
            throw redirect({ to: '/connect' });
        }

        const defaultToMemories = getDefaultToMemories();
        throw redirect({
            to: defaultToMemories ? '/memories' : '/gallery',
        });
    }
});

export const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/memories',
    component: () => (
        <NavigationLayout>
            <MemoriesLayout />
        </NavigationLayout>
    )
});

export const galleryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/gallery',
    component: () => (
        <NavigationLayout>
            <Gallery />
        </NavigationLayout>
    )
});

export const connectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/connect',
    component: Connect
});

export const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/map',
    component: () => (
        <NavigationLayout>
            <Suspense fallback={<div className='flex-auto bg-slate-900' />}>
                <Map />
            </Suspense>
        </NavigationLayout>
    )
});

export const albumsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/albums',
    component: () => (
        <NavigationLayout>
            <Albums />
        </NavigationLayout>
    )
});

export const albumRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/album/$albumId',
    component: () => (
        <NavigationLayout>
            <AlbumLayout />
        </NavigationLayout>
    )
});

export const yearRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/year/$year',
    component: () => (
        <NavigationLayout>
            <YearLayout />
        </NavigationLayout>
    )
});

export const tripRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/trip/$tripId',
    component: () => (
        <NavigationLayout>
            <TripLayout />
        </NavigationLayout>
    )
});

export const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    component: () => (
        <NavigationLayout>
            <Search />
        </NavigationLayout>
    )
});

export const menuRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/menu',
    component: () => (
        <NavigationLayout>
            <Menu />
        </NavigationLayout>
    )
});

export const recentlyDeletedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recently-deleted',
    component: () => (
        <NavigationLayout>
            <RecentlyDeletedItems />
        </NavigationLayout>
    )
});

export const failedItemsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/failed-items',
    component: () => (
        <NavigationLayout>
            <FailedItems />
        </NavigationLayout>
    )
});

export const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => (
        <NavigationLayout>
            <Settings />
        </NavigationLayout>
    )
});

export const s3SettingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/storage-settings',
    component: () => (
        <NavigationLayout>
            <StorageSettings />
        </NavigationLayout>
    )
});

export const linkDeviceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/link-device',
    component: () => (
        <NavigationLayout>
            <LinkDevice />
        </NavigationLayout>
    )
});

export const publicItemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/p/i/$shortPrimaryFileId/',
    component: () => (
        <PublicItemLayout />
    )
});

export const publicAlbumRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/p/a/$shortShareSecret/',
    component: () => (
        <PublicAlbumLayout />
    )
});

const routeTree = rootRoute.addChildren([
    indexRoute,
    homeRoute,
    galleryRoute,
    connectRoute,
    mapRoute,
    albumsRoute,
    albumRoute,
    yearRoute,
    tripRoute,
    searchRoute,
    menuRoute,
    recentlyDeletedRoute,
    failedItemsRoute,
    settingsRoute,
    s3SettingsRoute,
    linkDeviceRoute,
    publicItemRoute,
    publicAlbumRoute
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
