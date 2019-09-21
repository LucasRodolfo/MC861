import {MemoryRange} from '../MemoryRange';

export abstract class Device {

    protected _size: number;

    protected _memoryRange: MemoryRange;

    protected _name: string;

    public constructor(startAddress: number, endAddress: number, name: string) {
        this.memoryRange = new MemoryRange(startAddress, endAddress);
        this.size = endAddress - startAddress + 1;
        this.name = name;
    }

    get size(): number {
        return this._size;
    }

    set size(value: number) {
        this._size = value;
    }

    get memoryRange(): MemoryRange {
        return this._memoryRange;
    }

    set memoryRange(value: MemoryRange) {
        this._memoryRange = value;
    }

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    public abstract write(address: number, data: number): void;

    public abstract writeBuffer(address: number, buffer: Buffer): void;

    public abstract readByte(address: number, cpuAccess: boolean): number;

    public abstract toString(): string;
}
