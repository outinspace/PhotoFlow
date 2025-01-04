import { differenceInDays, format } from "date-fns";

export function formatRelativeOrLongDateTime(date: Date | string) {
    const daysDifference = differenceInDays(date, new Date());

    if (Math.abs(daysDifference) > 6) {
        return format(date, 'EEEE LLL do yyyy');
    } else {
        return format(date, 'EEEE h:mm a');
    }
}
