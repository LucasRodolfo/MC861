import {sprintf} from 'sprintf-js';

import {DEFAULT_END_ADDRESS, DEFAULT_START_ADDRESS} from './constants';
import {Device} from './devices/Device';
import {MemoryAccessException, MemoryRangeException} from './exceptions';

export class Bus {

    public readonly startAddress: number;
    public readonly endAddress: number;

    private deviceMap: Map<number, Set<Device>>;

    private deviceAddressArray: Device[];

    public constructor(startAddress: number = DEFAULT_START_ADDRESS, endAddress: number = DEFAULT_END_ADDRESS) {
        this.deviceMap = new Map<number, Set<Device>>();
        this.startAddress = startAddress;
        this.endAddress = endAddress;
    }

    private buildDeviceAddressArray(): void {

        this.deviceAddressArray = Array(this.endAddress - this.startAddress + 1);

        this.sortedDevices().forEach((device: Device) => {
            const range = device.memoryRange;
            for (let address = range.startAddress; address <= range.endAddress; address++) {
                this.deviceAddressArray[address - this.startAddress] = device;
            }
        });
    }

    private sortedDevices(): Set<Device> {
        const devices = new Set<Device>();

        Array.from(this.deviceMap.keys()).sort().forEach((priority: number) => {
            this.deviceMap.get(priority).forEach((device: Device) => devices.add(device));
        });

        return devices;
    }

    public addDevice(device: Device, priority: number = 0): void {

        const range = device.memoryRange;

        if (range.startAddress < this.startAddress || range.startAddress > this.endAddress) {
            throw new MemoryRangeException(`start address of device ${device.name} does not fall within the address range of the bus`);
        }

        if (range.endAddress < this.startAddress || range.endAddress > this.endAddress) {
            throw new MemoryRangeException(`end address of device ${device.name} does not fall within the address range of the bus`);
        }

        let deviceSet = this.deviceMap.get(priority);

        if (deviceSet == null) {
            deviceSet = new Set<Device>();
            this.deviceMap.set(priority, deviceSet);
        }

        deviceSet.add(device);
        this.buildDeviceAddressArray();
    }

    public removeDevice(device: Device): void {
        this.deviceMap.forEach((deviceSet: Set<Device>) => deviceSet.delete(device));
        this.buildDeviceAddressArray();
    }

    public isComplete(): boolean {
        if (this.deviceAddressArray == null) {
            this.buildDeviceAddressArray();
        }

        for (let address = this.startAddress; address <= this.endAddress; address++) {
            if (this.deviceAddressArray[address - this.startAddress] == null) {
                return false;
            }
        }

        return true;
    }

    public read(address: number, cpuAccess: boolean): number {

        const device = this.deviceAddressArray[address - this.startAddress];
        if (!device) {
            throw new MemoryAccessException(sprintf('Bus read failed. No device at address $%04X', address));
        }

        const deviceAddress = address - device.memoryRange.startAddress;
        return device.read(deviceAddress, cpuAccess) & 0xff;
    }

    public write(address: number, value: number): void {

        const device = this.deviceAddressArray[address - this.startAddress];
        if (!device) {
            throw new MemoryAccessException(sprintf('Bus write failed. No device at address $%04X', address));
        }

        const deviceAddress = address - device.memoryRange.startAddress;
        device.write(deviceAddress, value);
    }

    public loadProgram(address: number, program: number[] | Uint8Array): void {
        program.forEach((byte: number, i: number) => {
            this.write(address + i, byte);
        });
    }
}
