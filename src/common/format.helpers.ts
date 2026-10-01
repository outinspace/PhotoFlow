import { format } from 'date-fns';

export function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1000
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
};

// "1 Videos" was on screen under the menu for anyone with a single video.
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
};

// "Apr 3 – 9, 2026", "Mar 30 – Apr 2, 2026", or a single day.
export function formatDateRange(start: Date, end: Date) {
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
        return format(start, 'MMM d, yyyy');
    }

    if (start.getFullYear() !== end.getFullYear()) {
        return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
    }

    const endFormat = start.getMonth() === end.getMonth() ? 'd, yyyy' : 'MMM d, yyyy';
    return `${format(start, 'MMM d')} – ${format(end, endFormat)}`;
};
