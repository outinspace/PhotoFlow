import { useRouter } from '@tanstack/react-router';
import { NavArrowLeft } from 'iconoir-react';
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

export const glassCircleClasses = 'glass flex flex-none size-11 items-center justify-center rounded-full cursor-pointer hover:bg-white/80 active:bg-white';

export const TopBar = ({ title, rightButtons, onTitleClick, hideBack }: Props) => {
    const { history } = useRouter();

    return (
        // Sticky so a page that scrolls its whole body keeps the bar. Most pages put
        // it outside their scrolling element instead, where this is simply inert.
        <div className='sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 min-h-16 bg-slate-100/75 backdrop-blur-xl'>
            <div className='flex'>
                {!hideBack && (
                    <button
                        className={glassCircleClasses}
                        onClick={() => history.go(-1)}
                        title='Back'
                        aria-label='Back'
                    >
                        <NavArrowLeft className='size-6' />
                    </button>
                )}
            </div>
            <div
                className='text-[17px] font-semibold text-slate-900 truncate max-w-[55vw] md:max-w-md'
                onClick={() => onTitleClick?.()}
            >
                {title}
            </div>
            <div className='flex justify-end gap-2'>
                {rightButtons?.map((btn, i) => (
                    <div key={i} className='relative'>
                        <button
                            className={glassCircleClasses}
                            onClick={() => btn.onClick()}
                            title={btn.label}
                            aria-label={btn.label}
                        >
                            <btn.icon className={`size-6 ${btn.className ?? ''}`} />
                        </button>
                        {btn.children}
                    </div>
                ))}
            </div>
        </div>
    );
}
