import {RomDevice} from './RomDevice';

export class RamDevice extends RomDevice {

    public constructor(startAddress: number, endAddress: number, name: string, buffer: Buffer = Buffer.alloc(endAddress - startAddress, 0)) {
        super(startAddress, endAddress, name, buffer, true);
    }

    public write(address: number, data: number): void {
        this._buffer[address] = data;
    }

    public mirror(startAddress: number, endAddress: number, name: string): RamDevice {
        return new RamDevice(startAddress, endAddress, name, this._buffer);
    }
}
