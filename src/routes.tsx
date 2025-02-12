import React from 'react';
import { ReactNode, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import Gallery from "./gallery/gallery";
import Login from "./login/login";
import BottomBar from './bottom.bar';
import Albums from './albums/albums';
import Search from './search/search';
import Menu from './menu/menu';
import Map from './map/map';
import { RecentlyDeletedItems } from './menu/recently.deleted.items';
import { Billing } from './menu/billing';
import { AlbumLayout } from './albums/album.layout';
import { ItemsInProcess } from './menu/items.in.process';
import { PublicItemLayout } from './public/public.item.layout';
import { PublicAlbumLayout } from './public/public.album.layout';

const BottomBarLayout = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-auto flex-col">
        <div className='flex flex-auto flex-col' style={{ overflow: 'auto' }}>
            {children}
        </div>
        <BottomBar />
    </div>
);

export const rootRoute = createRootRoute();

export const galleryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/gallery',
    component: () => (
        <BottomBarLayout>
            <Gallery />
        </BottomBarLayout>
    )
});

export const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: Login
});

export const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/map',
    component: () => (
        <BottomBarLayout>
            <Map />
        </BottomBarLayout>
    )
});

export const albumsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/albums',
    component: () => (
        <BottomBarLayout>
            <Albums />
        </BottomBarLayout>
    )
});

export const albumRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/album/$albumId',
    component: () => (
        <BottomBarLayout>
            <AlbumLayout />
        </BottomBarLayout>
    )
});

export const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    component: () => (
        <BottomBarLayout>
            <Search />
        </BottomBarLayout>
    )
});

export const menuRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/menu',
    component: () => (
        <BottomBarLayout>
            <Menu />
        </BottomBarLayout>
    )
});

export const recentlyDeletedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recently-deleted',
    component: () => (
        <BottomBarLayout>
            <RecentlyDeletedItems />
        </BottomBarLayout>
    )
});

export const billingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/billing',
    component: () => (
        <BottomBarLayout>
            <Billing />
        </BottomBarLayout>
    )
});

export const itemsInProcessRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/items-in-process',
    component: () => (
        <BottomBarLayout>
            <ItemsInProcess />
        </BottomBarLayout>
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
    galleryRoute,
    loginRoute,
    mapRoute,
    albumsRoute,
    albumRoute,
    searchRoute,
    menuRoute,
    recentlyDeletedRoute,
    billingRoute,
    itemsInProcessRoute,
    publicItemRoute,
    publicAlbumRoute
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
