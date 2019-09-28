import * as fs from 'fs-extra';
import * as process from 'process';

import {Bus} from './lib/Bus';
import {ADDRESS, DEFAULT_END_ADDRESS, SIZE} from './lib/constants';
import {Cpu, InstructionBreakException} from './lib/Cpu';
import {CpuState} from './lib/CpuState';
import {Device} from './lib/devices/Device';
import {RamDevice} from './lib/devices/RamDevice';
import {RomDevice} from './lib/devices/RomDevice';
import {NesMapper} from './lib/NesMapper';
import {byteToHex, wordToHex} from './lib/utils';

export async function runNes(nesPath: string) {

    const nes = await fs.readFile(nesPath);

    const mapper = new NesMapper(nes);
    const nesFile = mapper.parse();

    const bus: Bus = new Bus();

    // TODO: map other devices
    const ram: Device = new RamDevice(ADDRESS.ZERO_PAGE, ADDRESS.PRG_ROM - 1, 'RAM');
    bus.addDevice(ram);

    // TODO: make it work
    // const romBuffer = nesFile.roms.reduce((bigBuffer, smallBuffer) => {
    //     return Buffer.concat([bigBuffer, smallBuffer]);
    // }, Buffer.alloc(0));

    // TODO: remove this workaround
    const romBuffer = Buffer.concat([nesFile.roms[1] || Buffer.alloc(SIZE.PRG_ROM), nesFile.roms[0]]);

    const rom: Device = new RomDevice(ADDRESS.PRG_ROM, DEFAULT_END_ADDRESS, 'PRG_ROM', romBuffer);

    bus.addDevice(rom);

    await dump(bus, `${nesPath}.dump`);

    const state: CpuState = new CpuState();

    const cpu = new Cpu(state, bus);
    cpu.reset();

    return await new Promise<number>((resolve, reject) => {
        setTimeout(() => {
            try {
                do {
                    cpu.step();
                } while (cpu.state.pc !== 0);

                resolve(null);
            } catch (err) {
                if (err instanceof InstructionBreakException) {
                    resolve(err.address);
                } else {
                    reject(err);
                }
            }
        }, 1);
    });
}

async function dump(bus: Bus, filepath: string): Promise<void> {

    const stream = await fs.createWriteStream(filepath);

    for (let i = 0; i < 0x10000; i++) {
        stream.write(`${wordToHex(i)}\t${byteToHex(bus.readByte(i, true))}\n`);
    }

    stream.end();
}

// tslint:disable:no-empty
runNes(process.argv[2])
    .then(() => {
    })
    .catch((err: Error) => console.error(err));
