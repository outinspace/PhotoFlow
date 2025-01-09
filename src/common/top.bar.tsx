import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'iconoir-react';
import React from 'react';

interface TopBarButton {
    icon: React.ForwardRefExoticComponent<Omit<React.SVGProps<SVGSVGElement>, "ref"> & React.RefAttributes<SVGSVGElement>>;
    className?: string;
    onClick: Function;
}

interface Props {
    title: string;
    rightButtons?: TopBarButton[];
}

export const TopBar = ({ title, rightButtons }: Props) => {
    const { history } = useRouter();

    return (
        <div className='flex justify-center items-center p-3 border-b'>
            <div className='absolute left-3 hover:bg-slate-200 rounded p-1'>
                <ArrowLeft
                    className='size-6 text-sky-500'
                    onClick={() => history.go(-1)}
                />
            </div>
            <div className='font-bold text-slate-900 truncate text-ellipsis' style={{ maxWidth: '50%' }}>
                {title}
            </div>
            <div className='flex absolute right-3'>
                {rightButtons?.map(btn => (
                    <div className='ml-2 p-1 hover:bg-slate-200 rounded text-slate-500'>
                        <btn.icon
                            className={`size-6 ${btn.className}`}
                            onClick={() => btn.onClick()}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
