import * as fs from 'fs-extra';

import {INesFile, NesMapper} from './NesMapper';
import {Bus} from './Bus';
import {Device} from './devices/Device';
import {RamDevice} from './devices/RamDevice';
import {CPU_ADDRESSES, CPU_MEMORY_MIRRORS, CPU_MEMORY_SIZE, DEFAULT_END_ADDRESS} from './constants';
import {RomDevice} from './devices/RomDevice';
import {CpuState} from './CpuState';
import {Cpu, InstructionBreakException} from './Cpu';
import {byteToHex, wordToHex} from './utils';
import {Ppu} from './Ppu';

export class Nes {

    private cpuBus: Bus;

    private cpu: Cpu;

    private ppuBus: Bus;

    private ppu: Ppu;

    // TODO: private apu: Apu;

    public async load(nesPath: string): Promise<void> {

        const nes = await fs.readFile(nesPath);

        const mapper = new NesMapper(nes);
        const nesFile = mapper.parse();

        this.initCpu(nesFile);

        this.initPpu(nesFile);

        // TODO: map other devices
    }

    private initCpu(nesFile: INesFile) {

        this.cpuBus = new Bus();

        // RAM

        const ram: RamDevice = new RamDevice(CPU_ADDRESSES.RAM, CPU_ADDRESSES.RAM + CPU_MEMORY_SIZE.RAM, 'RAM');
        this.cpuBus.addDevice(ram);

        for (let i = 1; i <= CPU_MEMORY_MIRRORS.RAM; i++) {
            const addr = CPU_ADDRESSES.RAM + i * CPU_MEMORY_SIZE.RAM;
            const mirror = ram.mirror(addr, addr + CPU_MEMORY_SIZE.RAM - 1);
            this.cpuBus.addDevice(mirror);
        }

        // PPU Registers

        const ppuRegisters = new RamDevice(CPU_ADDRESSES.PPU_REG, CPU_ADDRESSES.PPU_REG + CPU_MEMORY_SIZE.PPU_REG, 'PPU_REG');
        this.cpuBus.addDevice(ppuRegisters);

        for (let i = 1; i <= CPU_MEMORY_MIRRORS.PPU_REG; i++) {
            const addr = CPU_ADDRESSES.PPU_REG + i * CPU_MEMORY_SIZE.PPU_REG;
            const mirror = ram.mirror(addr, addr + CPU_MEMORY_SIZE.PPU_REG - 1);
            this.cpuBus.addDevice(mirror);
        }

        // APU Registers

        // TODO

        // ROM

        const romBuffer = Buffer.concat([nesFile.roms[1] || Buffer.alloc(CPU_MEMORY_SIZE.PRG_ROM), nesFile.roms[0]]);

        const rom: Device = new RomDevice(CPU_ADDRESSES.PRG_ROM, DEFAULT_END_ADDRESS, 'PRG_ROM', romBuffer);

        this.cpuBus.addDevice(rom);

        this.cpu = new Cpu(new CpuState(), this.cpuBus);
    }

    private initPpu(nesFile: INesFile) {

        this.ppuBus = new Bus();

        // TODO

        this.ppu = new Ppu(this.ppuBus);
    }

    public async run(dumpFile?: string): Promise<number> {

        this.cpu.reset();
        // TODO: this.ppu.reset();

        if (dumpFile) {
            await this.dump(`${dumpFile}.dump`);
        }

        return await new Promise<number>((resolve, reject) => {
            try {
                do {
                    this.cpu.step();
                } while (this.cpu.hasStep());

                resolve(this.cpu.state.pc);
            } catch (err) {
                if (err instanceof InstructionBreakException) {
                    resolve(err.address);
                } else {
                    reject(err);
                }
            }
        });
    }

    public async dump(filepath: string): Promise<void> {

        const stream = await fs.createWriteStream(filepath);

        for (let i = 0; i < 0x10000; i++) {
            stream.write(`${wordToHex(i)}\t${byteToHex(this.cpuBus.readByte(i, true))}\n`);
        }

        stream.end();
    }
}
