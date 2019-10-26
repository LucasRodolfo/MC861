import {Device} from './Device';

export class RomDevice extends Device {

    protected readonly _buffer: Buffer;

    public constructor(startAddress: number, endAddress: number, name: string, buffer: Buffer, isMirror: boolean = false) {

        super(startAddress, endAddress, name);

        if (isMirror) {
            this._buffer = buffer;
        } else {
            this._buffer = Buffer.alloc(endAddress - startAddress, 0);
            buffer.copy(this._buffer);
        }
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

    public mirror(startAddress: number, endAddress: number, name: string): RomDevice {
        return new RomDevice(startAddress, endAddress, name, this._buffer, true);
    }
}
