import {Device} from './Device';

export class RomDevice extends Device {

    protected readonly _buffer: Buffer;

    public constructor(startAddress: number, endAddress: number, name: string, buffer: Buffer) {

        super(startAddress, endAddress, name);

        this._buffer = Buffer.alloc(endAddress - startAddress, 0);
        buffer.copy(this._buffer);
    }

    public readByte(address: number, cpuAccess: boolean): number {
        return this._buffer[address];
    }

    public write(address: number, data: number): void {
        throw new Error('Cannot write into ROM');
    }

    public writeBuffer(address: number, buffer: Buffer): void {
        throw new Error('Cannot write into ROM');
    }

    public toString(): string {

        const start = this._memoryRange.startAddress.toString(16);
        const end = this._memoryRange.endAddress.toString(16);

        return `${this._name}[0x${start}..0x${end}]`;
    }
}
