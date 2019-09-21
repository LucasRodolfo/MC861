import {RomDevice} from './RomDevice';

export class RamDevice extends RomDevice {

    public constructor(startAddress: number, endAddress: number, name: string) {

        super(startAddress, endAddress, name, Buffer.alloc(endAddress - startAddress, 0));
    }

    public write(address: number, data: number): void {
        this._buffer[address] = data;
    }
}
