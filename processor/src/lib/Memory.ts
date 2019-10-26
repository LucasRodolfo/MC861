import {convertDecToHexString} from './Register';

export class Memory {

    private data: Buffer;

    constructor(data: Buffer) {
        this.data = data;
    }

    public clear(): void {
        for (let i = 0, il = this.getCapacity(); i < il; i++) {
            this.storeWithoutMapping(i, 0);
        }
    }

    public getCapacity() {
        return this.data.byteLength;
    }

    public load(address: number): number {
        return this.data[address];
    }

    public loadWithoutMapping(address: number): number {
        return this.data[address];
    }

    public store(address: number, value: number): void {
        this.data[address] = value;
    }

    public storeWithoutMapping(address: number, value: number): void {
        this.data[address] = value;
    }

    public dump(): string {
        let buffer = '';
        let previousIsZeroLine = false;
        const offset = this._getStartDumpAddress();
        const end = this._getEndDumpAddress();
        for (let i = offset; i < end; i++) {
            if (i % 0x10 === 0) {
                if (previousIsZeroLine) {
                    let skipZero = false;
                    while (this._checkNext16BytesIsZero(i + 0x10)) {
                        i += 0x10;
                        skipZero = true;
                    }
                    if (skipZero) {
                        buffer += '...\n';
                    }
                }
                buffer += convertDecToHexString(i - offset, 4) + ' ';
                previousIsZeroLine = true;
            }

            const value = this._loadForDump(i);
            buffer += convertDecToHexString(value, 2, true) + ' ';
            if (value !== 0) {
                previousIsZeroLine = false;
            }

            if (i % 0x10 === 0xf) {
                buffer += '\n';
            }
        }

        return buffer;
    }

    public _loadForDump(address: number): number {
        return this.loadWithoutMapping(address);
    }

    private _getStartDumpAddress(): number {
        return 0;
    }

    private _getEndDumpAddress(): number {
        return this.getCapacity();
    }

    private _checkNext16BytesIsZero(offset: number): boolean {
        if (offset + 0x10 >= this._getEndDumpAddress()) {
            return false;
        }

        let sum = 0;
        for (let i = offset; i < offset + 0x10; i++) {
            sum += this._loadForDump(i);
        }
        return sum === 0;
    }
}
