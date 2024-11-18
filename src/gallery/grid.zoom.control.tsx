import styled from '@emotion/styled';
import React from 'react';
import constants from '../design.constants';

interface Option {
    name: string;
}

interface Props<T extends Option> {
    options: T[];
    onSelect: (value: T) => any;
    value: T;
}

function GridZoomControl<T extends Option>({ options, onSelect, value }: Props<T>) {
    return (
        <div className='flex absolute left-0 right-0 bottom-5 justify-center pointer-events-none'>
            <div
                className='w-1/2 p-1 rounded-lg flex bg-slate-100 pointer-events-auto'
            >
                {options.map((option, i) => (
                    <div className={`flex-auto flex p-2 rounded-lg items-center justify-center hover:bg-slate-200 mr-1 last:mr-0 ${value === option && 'text-sky-500 font-bold bg-slate-200'}`}
                        key={option.name + i}
                        onClick={() => onSelect(option)}
                    >
                        {option.name}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Option = styled.div`
    flex: 1 1 auto;
    display: flex;
    height: 48px;
    border-radius: 100px;
    align-items: center;
    justify-content: center;
    font-family: roboto, sans-serif;
    font-weight: 400;
    font-size: 16px;
    margin: ${constants.space.XS};

    :hover {
        background-color: ${constants.colors.surface.level3};
    }
`;

export default GridZoomControl;
