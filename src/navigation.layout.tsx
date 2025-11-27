import { useRouter, useRouterState } from '@tanstack/react-router';
import { Book, Map, Menu, ViewGrid } from 'iconoir-react';
import { IS_STANDALONE } from './common/browser.utils';
import { ReactNode } from 'react';

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
        name: 'Menu',
        route: '/menu',
        icon: Menu
    }
];

export const NavigationLayout = ({ children }: { children: ReactNode }) => {
    const routerState = useRouterState();
    const router = useRouter();

    const safeAreaPadding = IS_STANDALONE ? 'pb-10 md:pb-2' : '';

    return (
        <div className="flex flex-auto flex-col md:flex-row">
            {/* Desktop: Vertical sidebar */}
            <div className='hidden md:flex flex-none flex-col bg-slate-50 border-r border-slate-200 p-2 w-24 transition-all'>
                {options.map(option => (
                    <div
                        key={option.route}
                        onClick={() => router.navigate({ to: option.route })}
                        className={`flex flex-col transition-all hover:bg-slate-100 active:bg-slate-300 rounded-md mb-2 last:mb-0 items-center justify-center ${routerState.location.pathname === option.route && 'bg-slate-200 font-bold text-sky-500'}`}
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
                        className={`flex-auto flex transition-all hover:bg-slate-100 active:bg-slate-300 rounded-md mr-2 last:mr-0 justify-center ${routerState.location.pathname === option.route && 'bg-slate-200 font-bold text-sky-500'}`}
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

