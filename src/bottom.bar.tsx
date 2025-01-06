import { useRouter, useRouterState } from '@tanstack/react-router';
import React from 'react';
import { Book, Map, Menu, Search, ViewGrid } from 'iconoir-react';

const options = [
    {
        name: 'Gallery',
        route: '/gallery',
        icon: ViewGrid
    },
    {
        name: 'Map',
        route: '/map',
        icon: Map
    },
    {
        name: 'Albums',
        route: '/albums',
        icon: Book
    },
    {
        name: 'Search',
        route: '/search',
        icon: Search
    },
    {
        name: 'Menu',
        route: '/menu',
        icon: Menu
    }
];

const isPwaApp = window.matchMedia('(display-mode: standalone)').matches;

const BottomBar = () => {
    const routerState = useRouterState();
    const router = useRouter();

    // HACK: Add bottom padding when in fullscreen PWA mode and on small device
    const safeAreaPadding = isPwaApp ? 'pb-10 md:pb-2' : '';

    return (
        <div className={'flex-none flex bg-slate-50 border-t p-2 transition-all ' + safeAreaPadding}>
            {options.map(option => (
                <div
                    key={option.route}
                    onClick={() => router.navigate({ to: option.route })}
                    className={`flex-auto flex transition-all hover:bg-slate-100 active:bg-slate-300 rounded-md mr-2 last:mr-0 justify-center ${routerState.location.pathname === option.route && 'bg-slate-200 font-bold text-sky-500'}`}
                >
                    <div className='p-3 flex flex-col items-center text-xs'>
                        <option.icon className='mb-1 h-5' />
                        {option.name}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BottomBar;
