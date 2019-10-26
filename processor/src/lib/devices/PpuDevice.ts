import {Device} from './Device';
import {Ppu} from '../Ppu';

export class PpuDevice extends Device {

    private readonly ppu: Ppu;

    public constructor(startAddress: number, endAddress: number, name: string, ppu: Ppu) {
        super(startAddress, endAddress, name);

        this.ppu = ppu;
    }

    public write(address: number, data: number): void {
        this.ppu.store(address, data);
    }

    public writeBuffer(address: number, buffer: Buffer): void {
        throw new Error('Not implemented');
    }

    public readByte(address: number, cpuAccess: boolean): number {
        return this.ppu.load(address);
    }

    public mirror(startAddress: number, endAddress: number, name: string): PpuDevice {
        return new PpuDevice(startAddress, endAddress, name, this.ppu);
    }
}
