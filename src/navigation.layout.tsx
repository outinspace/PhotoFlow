import { useRouter, useRouterState } from '@tanstack/react-router';
import { Map, Menu, ViewGrid, Flower, Search } from 'iconoir-react';
import { IS_STANDALONE } from './common/browser.utils';
import { isConfigured } from './storage/config';
import { ReactNode, useEffect } from 'react';

const options = [
    {
        name: 'Gallery',
        route: '/gallery',
        icon: ViewGrid
    },
    {
        name: 'Search',
        route: '/search',
        icon: Search
    },
    {
        name: 'Map',
        route: '/map',
        icon: Map
    },
    {
        name: 'Memories',
        route: '/memories',
        icon: Flower
    },
    {
        name: 'Menu',
        route: '/menu',
        icon: Menu
    }
];

export const NavigationLayout = ({ children }: { children: ReactNode }) => {
    const routerState = useRouterState();
    const router = useRouter();

    const safeAreaPadding = IS_STANDALONE ? 'pb-10 md:pb-2' : '';

    useEffect(() => {
        if (!isConfigured()) {
            router.navigate({ to: '/connect' });
        }
    }, []);

    return (
        <div className="flex flex-auto flex-col md:flex-row max-w-full">
            {/* Desktop: Vertical sidebar */}
            <div className='hidden md:flex flex-none flex-col bg-slate-50 border-r border-slate-200 p-2 w-24 transition-all'>
                {options.map(option => (
                    <div
                        key={option.route}
                        onClick={() => router.navigate({ to: option.route })}
                        className={`flex flex-col w-full transition-all hover:bg-slate-100 active:bg-slate-300 rounded-md mb-2 last:mb-0 items-center justify-center ${routerState.location.pathname === option.route && 'bg-slate-200 font-bold text-sky-500'}`}
                    >
                        <div className='p-3 flex flex-col items-center text-xs'>
                            <option.icon className='mb-1 h-5' />
                            {option.name}
                        </div>
                    </div>
                ))}
            </div>
            <div className='flex flex-auto flex-col' style={{ overflow: 'auto' }}>
                {children}
            </div>
            {/* Mobile: Horizontal bottom bar */}
            <div className={'md:hidden flex-none flex bg-slate-50 border-t border-slate-200 p-2 transition-all ' + safeAreaPadding}>
                {options.map(option => (
                    <div
                        key={option.route}
                        onClick={() => router.navigate({ to: option.route })}
                        className={`flex-1 basis-0 flex transition-all hover:bg-slate-100 active:bg-slate-300 rounded-md mr-2 last:mr-0 justify-center ${routerState.location.pathname === option.route && 'bg-slate-200 font-bold text-sky-500'}`}
                    >
                        <div className='p-3 flex flex-col items-center text-xs'>
                            <option.icon className='mb-1 h-5' />
                            {option.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

