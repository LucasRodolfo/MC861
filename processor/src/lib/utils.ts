export function low(val: number): number {
    return val & 0xff;
}

export function high(val: number): number {
    return (val >> 8) & 0xff;
}

export function byteToHex(val: number): string {
    return '0x' + ('0' + (val & 0xff).toString(16)).slice(-2);
}

export function wordToHex(val: number): string {
    return '0x' + ('000' + (val & 0xffff).toString(16)).slice(-4);
}

export function decodeAddress(lowByte: number, hiByte: number): number {
    return ((hiByte << 8) | lowByte) & 0xffff;
}

export function numberToByte(val: number): number {
    const ubyte = val & 0xff;
    return ubyte >= 128 ? ubyte - 256 : ubyte;
}

export function nanoseconds(time = process.hrtime()) {
    if (!Array.isArray(time) || time.length !== 2) {
        throw new TypeError('expected an array from process.hrtime()');
    }
    return +time[0] * 1e9 + +time[1];
}
