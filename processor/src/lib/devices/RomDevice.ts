import {Device} from './Device';

export class RomDevice extends Device {

    private readonly _buffer: Uint8Array;

    public constructor(startAddress: number, endAddress: number, name: string) {

        super(startAddress, endAddress, name);

        this._buffer = new Uint8Array(endAddress - startAddress);
    }

    public read(address: number, cpuAccess: boolean): number {
        return this._buffer[this._memoryRange.startAddress + address];
    }

    public write(address: number, data: number): void {
        this._buffer[this._memoryRange.startAddress + address] = data;
    }

    public toString(): string {

        const start = this._memoryRange.startAddress.toString(16);
        const end = this._memoryRange.endAddress.toString(16);

        return `${this._name}[0x${start}..0x${end}]`;
    }
}
