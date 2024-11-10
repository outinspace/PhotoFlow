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
            <Track>
                {options.map((option, i) => (
                    <Option
                        key={option.name + i}
                        onClick={() => onSelect(option)}
                        style={{
                            color: value === option ? constants.colors.text.level0 : constants.colors.text.level1,
                            backgroundColor: value === option ? constants.colors.surface.level2 : undefined
                        }}
                    >
                        {option.name}
                    </Option>
                ))}
            </Track>
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
