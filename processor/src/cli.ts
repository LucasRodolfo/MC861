import * as fs from 'fs-extra';
import * as process from 'process';

import {Bus} from './lib/Bus';
import {ADDRESS, DEFAULT_END_ADDRESS, SIZE} from './lib/constants';
import {Cpu} from './lib/Cpu';
import {CpuState} from './lib/CpuState';
import {Device} from './lib/devices/Device';
import {RomDevice} from './lib/devices/RomDevice';
import {NesMapper} from './lib/NesMapper';
import {RamDevice} from './lib/devices/RamDevice';

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

    const state: CpuState = new CpuState();

    const cpu = new Cpu(state, bus);
    cpu.reset();

    return await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            try {
                do {
                    cpu.step();
                } while (cpu.state.pc !== 0);

                resolve();
            } catch (err) {
                reject(err);
            }
        }, 1);
    });
}

// tslint:disable:no-empty
runNes(process.argv[2])
    .then(() => {
    })
    .catch((err: Error) => console.error(err));
