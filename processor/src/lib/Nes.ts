import * as fs from 'fs-extra';

import {INesFile, NesMapper} from './NesMapper';
import {Bus} from './Bus';
import {Device} from './devices/Device';
import {RamDevice} from './devices/RamDevice';
import {CPU_ADDRESSES, CPU_MEMORY_MIRRORS, CPU_MEMORY_SIZE, DEFAULT_END_ADDRESS, PPU_CYCLES} from './constants';
import {RomDevice} from './devices/RomDevice';
import {CpuState} from './CpuState';
import {Cpu, InstructionBreakException} from './Cpu';
import {byteToHex, wordToHex} from './utils';
import {Ppu} from './Ppu';
import {Display} from './Display';
import {PpuDevice} from './devices/PpuDevice';

export class Nes {

    private bus: Bus;

    private cpu: Cpu;

    private ppu: Ppu;

    // TODO: private apu: Apu;

    public async load(nesPath: string, canvas: HTMLCanvasElement): Promise<void> {

        const nes = await fs.readFile(nesPath);

        const mapper = new NesMapper(nes);
        const nesFile = mapper.parse();

        this.bus = new Bus();

        this.initCpu(nesFile);

        this.initPpu(nesFile, canvas);

        this.initApu(nesFile);

        // TODO: map other devices
    }

    private initCpu(nesFile: INesFile) {

        // RAM

        const ram: RamDevice = new RamDevice(CPU_ADDRESSES.RAM, CPU_ADDRESSES.RAM + CPU_MEMORY_SIZE.RAM, 'RAM');
        this.bus.addDevice(ram);

        for (let i = 1; i <= CPU_MEMORY_MIRRORS.RAM; i++) {
            const addr = CPU_ADDRESSES.RAM + i * CPU_MEMORY_SIZE.RAM;
            const mirror = ram.mirror(addr, addr + CPU_MEMORY_SIZE.RAM - 1, `RAM (mirror #${i}`);
            this.bus.addDevice(mirror);
        }

        // PPU Registers

        // const ppuRegisters = new RamDevice(CPU_ADDRESSES.PPU_REG, CPU_ADDRESSES.PPU_REG + CPU_MEMORY_SIZE.PPU_REG, 'PPU_REG');
        // this.bus.addDevice(ppuRegisters);
        //
        // for (let i = 1; i <= CPU_MEMORY_MIRRORS.PPU_REG; i++) {
        //     const addr = CPU_ADDRESSES.PPU_REG + i * CPU_MEMORY_SIZE.PPU_REG;
        //     const mirror = ppuRegisters.mirror(addr, addr + CPU_MEMORY_SIZE.PPU_REG - 1, `PPU_REG (mirror #${i}`);
        //     this.bus.addDevice(mirror);
        // }

        // APU Registers

        // TODO

        // ROM

        const romBuffer = Buffer.concat([nesFile.roms[1] || Buffer.alloc(CPU_MEMORY_SIZE.PRG_ROM), nesFile.roms[0]]);

        const rom: Device = new RomDevice(CPU_ADDRESSES.PRG_ROM, DEFAULT_END_ADDRESS, 'PRG_ROM', romBuffer);

        this.bus.addDevice(rom);

        this.cpu = new Cpu(new CpuState(), this.bus);
    }

    private initPpu(nesFile: INesFile, canvas: HTMLCanvasElement) {

        const display = new Display(canvas);

        const vramBuffer = Buffer.alloc(0x10000);
        Buffer.concat(nesFile.vroms).copy(vramBuffer);

        // @ts-ignore
        window.nesFile = nesFile;

        // const vrom: Device = new RomDevice(CPU_ADDRESSES., DEFAULT_END_ADDRESS, 'CHR_ROM', vramBuffer);

        this.ppu = new Ppu(this.bus, this.cpu, display, nesFile.header.mirroringType, vramBuffer);

        // PPU Registers

        const ppuStartAddr = CPU_ADDRESSES.PPU_REG;
        const ppuEndAddr = CPU_ADDRESSES.PPU_REG + CPU_MEMORY_SIZE.PPU_REG * CPU_MEMORY_MIRRORS.PPU_REG;

        const ppuRegisters = new PpuDevice(ppuStartAddr, ppuEndAddr, 'PPU_REG', this.ppu);
        this.bus.addDevice(ppuRegisters);
    }

    private initApu(nesFile: INesFile) {

        // TODO: remove this and implement APU initializer
        const fakeApuDevice = new RamDevice(0x4000, 0x401F, 'APU');
        this.bus.addDevice(fakeApuDevice);
    }

    public async run(dumpFile?: string): Promise<number> {

        this.cpu.reset();
        this.ppu.reset();

        if (dumpFile) {
            await this.dump(`${dumpFile}.dump`);
        }

        return await new Promise<number>((resolve, reject) => {

            const run = () => {
                if (this.cpu.hasStep()) {
                    for (let i = 0; i < PPU_CYCLES; i++) { // quantos ciclos?
                        this.cpu.step();
                        this.ppu.runCycle();
                        this.ppu.runCycle();
                        this.ppu.runCycle();
                    }
                    requestAnimationFrame(run);
                } else {
                    resolve(this.cpu.state.pc);
                }
            };

            try {
                requestAnimationFrame(run);
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
            stream.write(`${wordToHex(i)}\t${byteToHex(this.bus.readByte(i, true))}\n`);
        }

        stream.end();
    }
}
