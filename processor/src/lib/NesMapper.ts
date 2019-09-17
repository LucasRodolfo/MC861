import * as assert from 'assert';

export enum MirroringType {
    vertical = 0,
    horizontal = 1,
    fourScreen = 2,
    singleScreen = 3,
    singleScreen2 = 4,
    singleScreen3 = 5,
    singleScreen4 = 6,
    chrRom = 7
}

export interface INesHeader {
    romCount: number;
    vromCount: number;
    mirroring: number;
    batteryRam: number;
    trainer: number;
    fourScreen: number;
    mapperType: number;
    mirroringType: MirroringType;
}

export interface INesFile {
    header: INesHeader,
    roms: Buffer[];
    vroms: Buffer[];
}

export enum NesSize {
    MAGIC = 0x04,
    HEADER = 0x0a,
    PRG_ROM = 0x4000,
    CHR_ROM = 0x1000
}

export enum NesOffset {
    MAGIC = 0x00,
    HEADER = MAGIC + NesSize.MAGIC,
    PRG_ROM = HEADER + NesSize.HEADER,
    CHR_ROM = PRG_ROM + NesSize.PRG_ROM
}

export class NesMapper {

    private static MAGIC_NUMBER = 0x4e45531a;

    public constructor(private readonly buffer: Buffer) {
    }

    public isNes(): boolean {
        return this.buffer.readUInt32BE(NesOffset.MAGIC) === NesMapper.MAGIC_NUMBER;
    }

    public parse(): INesFile {
        assert(this.isNes(), 'Bad file signature');

        const header = this.parseHeader();
        assert(header.romCount >= 1, 'No ROM in this bank');

        const roms = this.loadPrgRoms(header.romCount);
        const vroms = this.loadChrRoms(header.vromCount);

        // TODO: create VROM tiles
        // TODO: convert CHR-ROM banks to tiles

        return {
            header,
            roms,
            vroms
        };
    }

    public parseHeader(): INesHeader {

        const raw = this.buffer.slice(NesOffset.HEADER, NesSize.HEADER);

        const zeroBytes0 = this.buffer.readUInt32BE(NesOffset.HEADER + 4) !== 0;
        const zeroBytes1 = this.buffer.readUInt32BE(NesOffset.HEADER + 8) !== 0;

        const mapperMask = zeroBytes0 || zeroBytes1 ? 0x0f : 0xff;

        // tslint:disable:object-literal-sort-keys
        return {
            romCount: raw[0],
            vromCount: raw[1] * 2,
            mirroring: raw[2] & 1 ? 1 : 0,
            batteryRam: (raw[2] >> 1) & 1,
            trainer: (raw[2] >> 2) & 1,
            fourScreen: (raw[2] >> 3) & 1,
            mapperType: ((raw[2] >> 4) | (raw[3] & 0xf0)) & mapperMask,

            get mirroringType(): MirroringType {
                if (this.fourScreen) {
                    return MirroringType.fourScreen;
                }
                if (this.mirroring === 0) {
                    return MirroringType.horizontal;
                }
                return MirroringType.vertical;
            }
        };
    }

    public loadPrgRoms(count: number): Buffer[] {
        return this.loadRoms(NesOffset.PRG_ROM, NesSize.PRG_ROM, count);
    }

    public loadChrRoms(count: number): Buffer[] {
        return this.loadRoms(NesOffset.CHR_ROM, NesSize.CHR_ROM, count);
    }

    private loadRoms(offset: NesOffset, size: NesSize, count: number): Buffer[] {

        return Array.from({length: count})
            .map((i: number) => {
                return this.buffer.slice(offset + i * size, size);
            });
    }
}
