import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import Gallery from "./gallery/gallery";
import Login from "./login/login";
import Setup from "./setup/setup";
import Albums from './albums/albums';
import Search from './search/search';
import Menu from './menu/menu';
import Map from './map/map';
import { RecentlyDeletedItems } from './menu/recently.deleted.items';
import Settings from './menu/settings';
import StorageSettings from './menu/storage.settings';
import { AlbumLayout } from './albums/album.layout';
import { ItemsInProcess } from './menu/items.in.process';
import { PublicItemLayout } from './gallery/public.item.layout';
import { PublicAlbumLayout } from './albums/public.album.layout';
import { NavigationLayout } from "./navigation.layout";
import MemoriesLayout from "./memories/memories.layout";
import { TripLayout } from "./memories/trip.layout";
import { YearLayout } from "./memories/year.layout";
import { getDefaultToMemories } from "./hooks/use.default.to.memories";
export const rootRoute = createRootRoute();

export const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad: () => {
        const tenantId = localStorage.getItem('tenantId');
        const sessionId = localStorage.getItem('sessionId');

        if (!tenantId || !sessionId) {
            throw redirect({ to: '/login' });
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

export const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: Login
});

export const setupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/setup',
    component: Setup
});

export const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/map',
    component: () => (
        <NavigationLayout>
            <Map />
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

export const itemsInProcessRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/items-in-process',
    component: () => (
        <NavigationLayout>
            <ItemsInProcess />
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

export const publicItemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/p/i/$shortTenantId/$shortPrimaryFileId/',
    component: () => (
        <PublicItemLayout />
    )
});

export const publicAlbumRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/p/a/$shortTenantId/$shortShareSecret/',
    component: () => (
        <PublicAlbumLayout />
    )
});

const routeTree = rootRoute.addChildren([
    indexRoute,
    homeRoute,
    galleryRoute,
    loginRoute,
    setupRoute,
    mapRoute,
    albumsRoute,
    albumRoute,
    yearRoute,
    tripRoute,
    searchRoute,
    menuRoute,
    recentlyDeletedRoute,
    itemsInProcessRoute,
    settingsRoute,
    s3SettingsRoute,
    publicItemRoute,
    publicAlbumRoute
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
