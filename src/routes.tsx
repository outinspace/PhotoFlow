import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import Gallery from "./gallery/gallery";

export const rootRoute = createRootRoute();

export const galleryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Gallery
});

const routeTree = rootRoute.addChildren([galleryRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
