export const NON_PRINTABLE = '.';

export const ASCII_CONSTANTS = [
    ' ', '!', '\'', '#', '$', '%', '&', '"',
    '(', ')', '*', '+', ',', '-', '.', '/',
    '0', '1', '2', '3', '4', '5', '6', '7',
    '8', '9', ':', ';', '<', '=', '>', '?',
    '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
    'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
    'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
    '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g',
    'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w',
    'x', 'y', 'z', '{', '|', '}', '~'
];

export function byteToAscii(val: number): string {
    return val >= 32 && val <= 126 ? ASCII_CONSTANTS[val - 32] : NON_PRINTABLE;
}

export function byteToHex(val: number): string {
    return '0x' + ('0' + (val & 0xff).toString(16)).slice(-2);
}

export function wordToHex(val: number): string {
    return '0x' + ('000' + (val & 0xffff).toString(16)).slice(-4);
}

export function address(lowByte: number, hiByte: number): number {
    return ((hiByte << 8) | lowByte) & 0xffff;
}

export function nanoseconds(time = process.hrtime()) {
    if (!Array.isArray(time) || time.length !== 2) {
        throw new TypeError('expected an array from process.hrtime()');
    }
    return +time[0] * 1e9 + +time[1];
}
