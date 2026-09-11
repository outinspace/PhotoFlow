import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'iconoir-react';
import { ReactNode } from 'react';

interface TopBarButton {
    icon: any;
    label: string;
    className?: string;
    onClick: Function;
    children?: ReactNode;
}

interface Props {
    title: string;
    rightButtons?: TopBarButton[];
    onTitleClick?: Function;
    hideBack?: boolean;
}

export const TopBar = ({ title, rightButtons, onTitleClick, hideBack }: Props) => {
    const { history } = useRouter();

    return (
        // Sticky so a page that scrolls its whole body keeps the bar. Most pages put
        // it outside their scrolling element instead, where this is simply inert.
        <div className='sticky top-0 z-10 flex justify-between items-center bg-white px-2 py-1 min-h-14 border-b border-slate-200'>
            {!hideBack && (
                <button
                    className='hover:bg-slate-200 rounded p-2 cursor-pointer'
                    onClick={() => history.go(-1)}
                    title='Back'
                    aria-label='Back'
                >
                    <ArrowLeft className='size-6 text-sky-500' />
                </button>
            )}
            <div
                className='font-bold text-slate-900 truncate text-ellipsis'
                style={{ maxWidth: '50%' }}
                onClick={() => onTitleClick?.()}
            >
                {title}
            </div>
            <div className='flex'>
                {rightButtons?.map((btn, i) => (
                    <button
                        key={i}
                        className='ml-2 p-2 hover:bg-slate-200 rounded text-slate-500 cursor-pointer'
                        onClick={() => btn.onClick()}
                        title={btn.label}
                        aria-label={btn.label}
                    >
                        <btn.icon className={`size-6 ${btn.className}`} />
                        {btn.children}
                    </button>
                ))}
            </div>
        </div>
    );
}
