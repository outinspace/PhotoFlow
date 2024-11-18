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
        <Container>
            <div className='w-1/2 p-1 rounded-lg flex backdrop-blur bg-slate-900/10'>
                {options.map((option, i) => (
                    <div className={`flex-auto flex p-3 rounded-lg items-center justify-center hover:bg-slate-900/25 mr-1 last:mr-0 text-slate-200 ${value === option && 'text-slate-100 font-bold bg-slate-900/25'}`}
                        key={option.name + i}
                        onClick={() => onSelect(option)}
                    >
                        {option.name}
                    </div>
                ))}
            </div>
        </Container>
    );
};

const Container = styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: ${constants.space.XL};
    display: flex;
    justify-content: center;
`;

const Track = styled.div`
    width: 300px;
    background-color: rgba(0,0,0,0.2);
    border-radius: 100px;
    backdrop-filter: blur(8px);
    display: flex;
`;

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
