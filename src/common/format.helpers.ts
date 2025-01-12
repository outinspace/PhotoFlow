export function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1000
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
};

export function compactGUID(guid: string) {
    // Remove dashes from the GUID
    const hex = guid.replace(/-/g, '');

    // Convert the hex string to a byte array
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    // Convert byte array to Base64
    const base64 = btoa(String.fromCharCode(...bytes));

    // Remove Base64 padding for compactness
    return base64.replace(/=/g, '');
}

export function expandGUID(compacted: string) {
    // Add back padding if necessary
    const paddedBase64 = compacted.padEnd(compacted.length + (4 - compacted.length % 4) % 4, '=');

    // Decode the Base64 string into a byte array
    const binaryString = atob(paddedBase64);
    const bytes = new Uint8Array([...binaryString].map(char => char.charCodeAt(0)));

    // Convert the byte array to a hexadecimal string
    const hex = Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    // Reinsert dashes to form the GUID
    return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20)}`;
}
