import { differenceInDays, format, formatRelative } from "date-fns";

export function formatAsLongRelativeDateTime(date: Date | string) {
    const daysDifference = differenceInDays(date, new Date());

    if (Math.abs(daysDifference) > 6) {
        return format(date, 'EEE, LLLL do, yyyy');
    }

    let formatString = formatRelative(date, new Date());

    // Upper case first char
    formatString = formatString[0].toUpperCase() + formatString.slice(1);

    return formatString;
}
