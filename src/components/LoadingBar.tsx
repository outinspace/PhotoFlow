import React from 'react';
import { useIsFetching } from '@tanstack/react-query';

export const GlobalLoadingBar = () => {
    const isFetching = useIsFetching();

    return (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-transparent z-50 overflow-hidden">
            <div 
                className={`bg-sky-500 transition-all duration-300 ease-in-out ${
                    isFetching 
                        ? 'w-full h-full' 
                        : 'w-full h-0'
                }`}
            />
        </div>
    );
}; 