import * as fs from 'fs-extra';
import * as process from 'process';

import {Bus} from './lib/Bus';
import {DEFAULT_END_ADDRESS, DEFAULT_LOAD_ADDRESS, DEFAULT_START_ADDRESS} from './lib/constants';
import {Cpu} from './lib/Cpu';
import {CpuState} from './lib/CpuState';
import {Device} from './lib/devices/Device';
import {RomDevice} from './lib/devices/RomDevice';
import {NesMapper} from './lib/NesMapper';

export async function runNes(nesPath: string) {

    const nes = await fs.readFile(nesPath);

    const mapper = new NesMapper(nes);
    const nesFile = mapper.parse();

    const rom: Device = new RomDevice(DEFAULT_START_ADDRESS, DEFAULT_END_ADDRESS, 'ROM');

    const bus: Bus = new Bus();
    bus.addDevice(rom, 0);
    bus.loadProgram(DEFAULT_LOAD_ADDRESS, nesFile.roms[0]);

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
    .then(() => {})
    .catch((err: Error) => console.error(err));
