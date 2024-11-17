import React from 'react';
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import Gallery from "./gallery/gallery";
import Login from "./login/login";
import BottomBar from './bottom.bar';

export const rootRoute = createRootRoute();

export const galleryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/gallery',
    component: () => (
        <div className="flex flex-auto flex-col">
            <Gallery />
            <BottomBar />
        </div>
    )
});

export const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: Login
});

const routeTree = rootRoute.addChildren([galleryRoute, loginRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
