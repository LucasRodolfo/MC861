export type RegisterType = Uint8Array | Uint16Array;

export abstract class Register {

    protected array: RegisterType;

    constructor(array: RegisterType) {
        this.array = array;
    }

    get data(): number {
        return this.array[0];
    }

    set data(data: number) {
        this.array[0] = data;
    }

    public getWidth() {
        return this.array.byteLength * 8;
    }

    public load() {
        return this.data;
    }

    public loadBit(pos: number): number {
        return (this.data >> pos) & 1;
    }

    public loadBits(offset: number, size: number): number {
        return (this.data >> offset) & ((1 << size) - 1);
    }

    public store(value: number): void {
        this.data = value;
    }

    public storeBit(pos: number, value: number) {
        value = value & 1;  // just in case
        this.data = this.data & ~(1 << pos) | (value << pos);
    }

    public storeBits(offset: number, size: number, value: number): void {
        const mask = (1 << size) - 1;
        value = value & mask;
        this.data = this.data & ~(mask << offset) | (value << offset);
    }

    public clear(): void {
        this.data = 0;
    }

    public setBit(pos: number): void {
        this.storeBit(pos, 1);
    }

    public clearBit(pos: number): void {
        this.storeBit(pos, 0);
    }

    public isBitSet(pos: number): boolean {
        return this.loadBit(pos) === 1;
    }

    public increment(): void {
        this.data++;
    }

    public incrementBy2(): void {
        this.data += 2;
    }

    public add(value: number): void {
        this.data += value;
    }

    public decrement(): void {
        this.data--;
    }

    public decrementBy2(): void {
        this.data -= 2;
    }

    public sub(value: number): void {
        this.data -= value;
    }

    public shift(value: number): number {
        value = value & 1;  // just in case
        const carry = this.loadBit(this.getWidth() - 1);
        this.data = (this.data << 1) | value;
        return carry;
    }

    public dump(): string {
        return convertDecToHexString(this.load(), this.getWidth() / 4);
    }
}

export function convertDecToHexString(num: number, width: number, noPrefix: boolean = false): string {
    const str = num.toString(16);

    let prefix = '';

    if (num < 0) {
        prefix += '-';
    }

    if (noPrefix !== true) {
        prefix += '0x';
    }

    if (width === undefined) {
        return prefix + str;
    }

    let base = '';

    for (let i = 0; i < width; i++) {
        base += '0';
    }

    return prefix + (base + str).substr(-1 * width);
}

export class Register8bit extends Register {
    constructor() {
        super(new Uint8Array(1));
    }
}

export class Register16bit extends Register {

    private bytes: Uint8Array;

    constructor() {
        super(new Uint16Array(1));

        this.bytes = new Uint8Array(this.array.buffer);
    }

    public loadHigherByte(): number {
        return this.bytes[1];
    }

    public loadLowerByte(): number {
        return this.bytes[0];
    }

    public storeHigherByte(value: number): void {
        this.bytes[1] = value;
    }

    public storeLowerByte(value: number): void {
        this.bytes[0] = value;
    }
}
