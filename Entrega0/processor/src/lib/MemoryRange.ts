import {sprintf} from 'sprintf-js';
import {MemoryRangeException} from './exceptions';

export class MemoryRange {

    private _startAddress: number;
    private _endAddress: number;

    public constructor(startAddress: number, endAddress: number) {
        if (startAddress < 0 || endAddress < 0) {
            throw new MemoryRangeException('Addresses cannot be less than 0.');
        }

        if (startAddress >= endAddress) {
            throw new MemoryRangeException('End address must be greater than start address.');
        }

        this.startAddress = startAddress;
        this.endAddress = endAddress;
    }

    // @ts-ignore
    get startAddress(): number {
        return this._startAddress;
    }

    // @ts-ignore
    set startAddress(value: number) {
        this._startAddress = value;
    }

    // @ts-ignore
    get endAddress(): number {
        return this._endAddress;
    }

    // @ts-ignore
    set endAddress(value: number) {
        this._endAddress = value;
    }

    public includes(address: number): boolean {
        return address <= this.endAddress && address >= this.startAddress;
    }

    public overlaps(other: MemoryRange): boolean {
        return this.includes(other.startAddress) || other.includes(this.startAddress);
    }

    public toString(): string {
        return '@' + sprintf('0x%04x', this.startAddress) + '-' + sprintf('0x%04x', this.endAddress);
    }
}
