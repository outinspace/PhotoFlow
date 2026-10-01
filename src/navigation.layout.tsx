import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { Map, Menu, ViewGrid, Flower, Search, MediaImageFolder, Settings } from 'iconoir-react';
import { InstallPrompt } from './common/install.prompt';
import { isConfigured } from './storage/config';
import { ReactNode, useEffect, useMemo } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useHeartbeat } from './storage/heartbeat';
import { useAlbumsWithItems } from './api/useAlbumsWithItems';
import { MediaImage } from './common/media.image';
import UploadButton from './menu/upload.button';

// With no server there is nothing to alert on a worker that quietly stopped, so
// the app itself says so once the last recorded run is more than three days old.
const StaleProcessingBanner = () => {
    const { data: heartbeat } = useHeartbeat();
    const router = useRouter();
    const days = heartbeat ? differenceInCalendarDays(new Date(), new Date(heartbeat.finishedAt)) : 0;

    if (days <= 3) return null;

    return (
        <button
            type='button'
            className='flex-none m-3 mb-0 rounded-2xl bg-amber-100 text-amber-900 text-sm text-center px-4 py-2.5 cursor-pointer'
            onClick={() => router.navigate({ to: '/storage-settings' })}
        >
            New photos have not been processed in {days} days.
        </button>
    );
};

// The home page's phone illustration still draws the old five-tab bar from this.
export const options = [
    { name: 'Gallery', route: '/gallery', icon: ViewGrid },
    { name: 'Search', route: '/search', icon: Search },
    { name: 'Map', route: '/map', icon: Map },
    { name: 'Memories', route: '/memories', icon: Flower },
    { name: 'Menu', route: '/menu', icon: Menu }
];

// Each destination also owns the pages you reach from it, so its tab stays lit
// while you are inside an album or a settings page.
const destinations = [
    { name: 'Library', route: '/gallery', icon: ViewGrid, owns: ['/gallery'] },
    { name: 'Collections', route: '/memories', icon: MediaImageFolder, owns: ['/memories', '/albums', '/album/', '/trip/', '/year/'] },
    { name: 'Map', route: '/map', icon: Map, owns: ['/map'] }
] as const;

const settingsRoutes = ['/menu', '/settings', '/storage-settings', '/link-device', '/recently-deleted', '/failed-items'];

const isWithin = (pathname: string, prefixes: readonly string[]) =>
    prefixes.some(prefix => prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix);

const sidebarRowClasses = 'flex items-center gap-3 h-11 px-3.5 rounded-full text-[15px] font-medium hover:bg-black/5 active:bg-black/10 cursor-pointer';

const RecentAlbums = () => {
    const albums = useAlbumsWithItems();

    // Most recently added to first, the same order Collections uses.
    const recent = useMemo(() => {
        const latest = (items: { captureTime: string }[]) =>
            items.reduce((max, item) => Math.max(max, parseISO(item.captureTime).getTime()), 0);

        return [...(albums ?? [])]
            .sort((a, b) => latest(b.items) - latest(a.items))
            .slice(0, 6);
    }, [albums]);

    if (recent.length === 0) return null;

    return (
        <div className='mt-5 flex flex-col gap-0.5 min-h-0 overflow-y-auto'>
            <Link to='/albums' className='px-3.5 pb-1 text-[13px] font-semibold text-slate-500 hover:text-slate-700'>
                Albums
            </Link>
            {recent.map(album => (
                <Link
                    key={album.albumId}
                    to='/album/$albumId'
                    params={{ albumId: album.albumId.toString() }}
                    className={`${sidebarRowClasses} pl-2.5`}
                    activeProps={{ className: 'bg-black/[0.07]' }}
                >
                    <MediaImage
                        source={album.items[0]?.primaryFile.tileImageSource}
                        alt=''
                        className='size-7 flex-none rounded-lg object-cover bg-slate-200'
                    />
                    <span className='flex-auto min-w-0 truncate'>{album.name}</span>
                    <span className='text-[13px] text-slate-500'>{album.items.length}</span>
                </Link>
            ))}
        </div>
    );
};

const Sidebar = ({ pathname }: { pathname: string }) => (
    <nav aria-label='Main' className='glass hidden md:flex flex-none flex-col w-58 m-3 mr-0 p-3 pt-4 rounded-[28px]'>
        <div className='px-3.5 pb-3 text-[17px] font-bold italic tracking-tight'>PhotoFlow</div>
        <div className='flex flex-col gap-0.5'>
            {destinations.map(destination => (
                <Link
                    key={destination.route}
                    to={destination.route}
                    className={`${sidebarRowClasses} ${isWithin(pathname, destination.owns) ? 'bg-black/[0.07] font-semibold' : ''}`}
                >
                    <destination.icon className='size-5' />
                    {destination.name}
                </Link>
            ))}
            <Link
                to='/search'
                className={`${sidebarRowClasses} ${pathname === '/search' ? 'bg-black/[0.07] font-semibold' : ''}`}
            >
                <Search className='size-5' />
                Search
            </Link>
        </div>
        <RecentAlbums />
        <div className='flex-auto' />
        <Link
            to='/menu'
            className={`${sidebarRowClasses} ${isWithin(pathname, settingsRoutes) ? 'bg-black/[0.07] font-semibold' : ''}`}
        >
            <Settings className='size-5' />
            Settings
        </Link>
        <div className='mt-2'>
            <UploadButton variant='sidebar' />
        </div>
    </nav>
);

// iOS 26 style: three tabs in one floating capsule, and search on its own beside it.
const TabBar = ({ pathname }: { pathname: string }) => (
    <div
        className='md:hidden fixed inset-x-4 z-10 flex items-center gap-3 pointer-events-none'
        style={{ bottom: 'calc(var(--tabbar-space) - 76px)' }}
    >
        <nav aria-label='Main' className='glass pointer-events-auto flex flex-auto h-15 p-1 rounded-full'>
            {destinations.map(destination => {
                const active = isWithin(pathname, destination.owns);
                return (
                    <Link
                        key={destination.route}
                        to={destination.route}
                        aria-current={active ? 'page' : undefined}
                        className={`flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold ${active ? 'bg-black/[0.07] text-sky-600' : 'text-slate-800'}`}
                    >
                        <destination.icon className='size-6' />
                        {destination.name}
                    </Link>
                );
            })}
        </nav>
        <Link
            to='/search'
            aria-label='Search'
            className={`glass pointer-events-auto flex flex-none size-15 items-center justify-center rounded-full ${pathname === '/search' ? 'text-sky-600' : 'text-slate-800'}`}
        >
            <Search className='size-6' />
        </Link>
    </div>
);

export const NavigationLayout = ({ children }: { children: ReactNode }) => {
    const pathname = useRouterState({ select: state => state.location.pathname });
    const router = useRouter();

    useEffect(() => {
        if (!isConfigured()) {
            router.navigate({ to: '/connect' });
        }
    }, []);

    return (
        <div className="flex flex-auto flex-col md:flex-row max-w-full">
            <Sidebar pathname={pathname} />
            <div className='relative flex flex-auto flex-col min-w-0' style={{ overflow: 'auto' }}>
                <InstallPrompt />
                <StaleProcessingBanner />
                {children}
            </div>
            <TabBar pathname={pathname} />
        </div>
    );
};
