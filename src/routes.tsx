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

const routeTree = rootRoute.addChildren([
    galleryRoute,
    loginRoute,
    mapRoute,
    albumsRoute,
    searchRoute,
    menuRoute,
    recentlyDeletedRoute,
    billingRoute
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
