import {MemoryRange} from './MemoryRange';
import {Bus} from './Bus';

export abstract class Device {

    private _size: number;

    private _memoryRange: MemoryRange;

    private _name: string;

    private _bus: Bus;

    // TODO: implement DeviceChangeListener

    public constructor(startAddress: number, endAddress: number, name: string) {
        this.memoryRange = new MemoryRange(startAddress, endAddress);
        this.size = endAddress - startAddress + 1;
        this.name = name;
    }

    // @ts-ignore
    get size(): number {
        return this._size;
    }

    // @ts-ignore
    set size(value: number) {
        this._size = value;
    }

    // @ts-ignore
    get memoryRange(): MemoryRange {
        return this._memoryRange;
    }

    // @ts-ignore
    set memoryRange(value: MemoryRange) {
        this._memoryRange = value;
    }

    // @ts-ignore
    get name(): string {
        return this._name;
    }

    // @ts-ignore
    set name(value: string) {
        this._name = value;
    }

    // @ts-ignore
    get bus(): Bus {
        return this._bus;
    }

    // @ts-ignore
    set bus(value: Bus) {
        this._bus = value;
    }

    public abstract write(address: number, data: number): void;

    public abstract read(address: number, cpuAccess: boolean): number;

    public abstract toString(): string;
}
