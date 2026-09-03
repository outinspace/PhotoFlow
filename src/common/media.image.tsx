import { ImgHTMLAttributes } from 'react';
import { useMediaUrl } from '../api/useMediaUrl';

// An <img> for something in the private bucket.
//
// A URL for a bucket key only exists once it has been signed, and signing is
// asynchronous, so the element renders without a src until that resolves. It
// exists as a component rather than a bare hook call because most of these render
// inside a map over items, where a hook cannot go.

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    source: string | null | undefined;
}

export const MediaImage = ({ source, ...rest }: Props) => {
    const url = useMediaUrl(source);
    return <img src={url ?? undefined} {...rest} />;
};
