import { Link } from '@tanstack/react-router';
import { ReactNode } from 'react';

interface Props {
    title: string;
    seeAllTo?: '/albums';
    children: ReactNode;
}

export const Section = ({ title, seeAllTo, children }: Props) => (
    <section className='mb-8'>
        <div className='flex items-baseline justify-between mb-3 px-5'>
            <h2 className='text-[22px] font-bold tracking-tight text-slate-900'>{title}</h2>
            {seeAllTo && (
                <Link to={seeAllTo} className='text-[15px] font-medium text-sky-600 hover:text-sky-700'>
                    See All
                </Link>
            )}
        </div>
        {children}
    </section>
);

// A row that scrolls sideways and snaps card by card, with no scrollbar drawn.
export const CardRow = ({ children }: { children: ReactNode }) => (
    <div className='overflow-x-auto snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        <div className='flex gap-3 px-5' style={{ width: 'max-content' }}>
            {children}
        </div>
    </div>
);
