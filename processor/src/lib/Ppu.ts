import {convertDecToHexString, Register16bit, Register8bit} from './Register';
import {COLOR_PALETTES, OAM_RAM_SIZE, OAM_RAM_SIZE_2} from './constants';
import {Memory} from './Memory';
import {Display} from './Display';
import {MirroringType} from './NesMapper';
import {Bus} from './Bus';
import {Cpu} from './Cpu';
import {RamDevice} from './devices/RamDevice';

// https://wiki.nesdev.com/w/index.php/PPU
export class Ppu {

    private frame: number = 0;

    private scanLine: number = 0;
    private cycle: number = 0;

    private hasChrRom: boolean;

    private vRam: Memory;       // 16KB
    private oamRam: Memory;     // 256B, primary OAM memory
    private oamRam2: Memory;    // 32B, secondary OAM memory

    private ppuctrl = new PpuControlRegister();  // 0x2000
    private ppumask = new PpuMaskRegister();     // 0x2001
    private ppustatus = new PpuStatusRegister(); // 0x2002
    private oamaddr = new Register8bit();        // 0x2003
    private oamdata = new Register8bit();        // 0x2004
    private ppuscroll = new Register8bit();      // 0x2005
    private ppuaddr = new Register8bit();        // 0x2006
    private ppudata = new Register8bit();        // 0x2007
    private oamdma = new Register8bit();         // 0x4014

    private nameTableRegister = new Register8bit();
    private attributeTableLowRegister = new Register16bit();
    private attributeTableHighRegister = new Register16bit();
    private patternTableLowRegister = new Register16bit();
    private patternTableHighRegister = new Register16bit();

    private spritesManager: SpritesManager;
    private spritesManager2: SpritesManager;

    private nameTableLatch = 0;
    private attributeTableLowLatch = 0;
    private attributeTableHighLatch = 0;
    private patternTableLowLatch = 0;
    private patternTableHighLatch = 0;

    private fineXScroll = 0;
    private currentVRamAddress = 0;
    private temporalVRamAddress = 0;

    private vRamReadBuffer = 0;
    private registerFirstStore = true;

    private spritePixels: number[];
    private spriteIds: number[];
    private spritePriorities: number[];

    constructor(private readonly bus: Bus,
                private readonly cpu: Cpu,
                private readonly display: Display,
                private readonly mirroringType: MirroringType,
                vRamBuffer: Buffer) {

        this.hasChrRom = vRamBuffer.length > 0;
        this.vRam = new Memory(vRamBuffer);

        this.oamRam = new Memory(Buffer.alloc(OAM_RAM_SIZE));
        this.oamRam2 = new Memory(Buffer.alloc(OAM_RAM_SIZE_2));

        this.spritesManager = new SpritesManager(this.oamRam);
        this.spritesManager2 = new SpritesManager(this.oamRam2);
    }

    public init(): void {

        this.ppustatus.store(0x80);

        this.spritePixels = [];
        this.spriteIds = [];
        this.spritePriorities = [];

        for (let i = 0; i < 256; i++) {
            this.spritePixels[i] = -1;
            this.spriteIds[i] = -1;
            this.spritePriorities[i] = -1;
        }
    }

    // https://wiki.nesdev.com/w/index.php/PPU_power_up_state
    public bootup(): void {
        this.ppustatus.store(0x80);
    }

    public reset(): void {
        this.init();
    }

    public runCycle(): void {
        this.renderPixel();
        this.shiftRegisters();
        this.fetch();
        this.evaluateSprites();
        this.updateFlags();
        this.countUpScrollCounters();
        this.countUpCycle();
    }

    public renderPixel(): void {
        // Note: this comparison order is for performance.
        if (this.cycle >= 257 || this.scanLine >= 240 || this.cycle === 0) {
            return;
        }

        const x = this.cycle - 1 ;
        const y = this.scanLine;

        const backgroundVisible = this.ppumask.isBackgroundVisible();
        const spritesVisible = this.ppumask.isSpritesVisible();

        const backgroundPixel = this.getBackgroundPixel();
        const spritePixel = this.spritePixels[x];
        const spriteId = this.spriteIds[x];
        const spritePriority = this.spritePriorities[x];

        let c = COLOR_PALETTES[this.load(0x3F00)];

        if (backgroundVisible === true && spritesVisible === true) {
            if (spritePixel === -1) {
                c = backgroundPixel;
            } else {
                if (backgroundPixel === c) {
                    c = spritePixel;
                } else {
                    c = spritePriority === 0 ? spritePixel : backgroundPixel;
                }
            }
        } else if (backgroundVisible === true && spritesVisible === false) {
            c = backgroundPixel;
        } else if (backgroundVisible === false && spritesVisible === true) {
            if (spritePixel !== -1) {
                c = spritePixel;
            }
        }

        if (this.ppumask.emphasisRed() === true) {
            c = c | 0x00FF0000;
        }
        if (this.ppumask.emphasisGreen() === true) {
            c = c | 0x0000FF00;
        }
        if (this.ppumask.emphasisBlue() === true) {
            c = c | 0x000000FF;
        }

        if (backgroundVisible === true && spritesVisible === true &&
            spriteId === 0 && spritePixel !== 0 && backgroundPixel !== 0) {
            this.ppustatus.setZeroHit();
        }

        this.display.renderPixel(x, y, c);
    }

    public shiftRegisters(): void {
        if (this.scanLine >= 240 && this.scanLine <= 260) {
            return;
        }

        if ((this.cycle >= 1 && this.cycle <= 256) ||
            (this.cycle >= 329 && this.cycle <= 336)) {
            this.patternTableLowRegister.shift(0);
            this.patternTableHighRegister.shift(0);
            this.attributeTableLowRegister.shift(0);
            this.attributeTableHighRegister.shift(0);
        }
    }

    public loadRegister(address: number) {
        switch (address) {

            // ppustatus load

            case 0x2002: {
                const value = this.ppustatus.load();
                this.ppustatus.clearVBlank();
                this.registerFirstStore = true;
                return value;
            }

            // oamdata load

            case 0x2004:
                return this.oamRam.load(this.oamaddr.load());

            // ppudata load

            case 0x2007: {
                let value;

                if ((this.currentVRamAddress & 0x3FFF) >= 0 &&
                    (this.currentVRamAddress & 0x3FFF) < 0x3F00) {
                    value = this.vRamReadBuffer;
                    this.vRamReadBuffer = this.load(this.currentVRamAddress);
                } else {
                    value = this.load(this.currentVRamAddress);
                    this.vRamReadBuffer = value;
                }

                this.incrementVRamAddress();
                return value;
            }
        }

        return 0;
    }

    public storeRegister(address: number, value: number) {
        switch (address) {

            // ppuctrl store

            case 0x2000:
                this.ppuctrl.store(value);
                this.temporalVRamAddress &= ~0xC00;
                this.temporalVRamAddress |= (value & 0x3) << 10;
                break;

            // ppumask store

            case 0x2001:
                this.ppumask.store(value);
                break;

            // oamaddr store

            case 0x2003:
                this.oamaddr.store(value);
                break;

            // oamdata store

            case 0x2004:
                this.oamdata.store(value);
                this.oamRam.store(this.oamaddr.load(), value);
                this.oamaddr.increment();
                break;

            // ppuscroll store

            case 0x2005:
                this.ppuscroll.store(value);

                if (this.registerFirstStore === true) {
                    this.fineXScroll = value & 0x7;
                    this.temporalVRamAddress &= ~0x1F;
                    this.temporalVRamAddress |= (value >> 3) & 0x1F;
                } else {
                    this.temporalVRamAddress &= ~0x73E0;
                    this.temporalVRamAddress |= (value & 0xF8) << 2;
                    this.temporalVRamAddress |= (value & 0x7) << 12;
                }

                this.registerFirstStore = !this.registerFirstStore;

                break;

            // ppuaddr store

            case 0x2006:
                if (this.registerFirstStore === true) {
                    this.temporalVRamAddress &= ~0x7F00;
                    this.temporalVRamAddress |= (value & 0x3F) << 8;
                } else {
                    this.ppuaddr.store(value);
                    this.temporalVRamAddress &= ~0xFF;
                    this.temporalVRamAddress |= (value & 0xFF);
                    this.currentVRamAddress = this.temporalVRamAddress;
                }

                this.registerFirstStore = !this.registerFirstStore;

                break;

            // ppudata store

            case 0x2007:
                this.ppudata.store(value);

                this.store(this.currentVRamAddress, value);
                this.incrementVRamAddress();

                break;

            // oamdma store

            case 0x4014:
                this.oamdma.store(value);

                const offset = value * 0x100;

                for (let i = this.oamaddr.load(); i < 256; i++) {
                    this.oamRam.store(i, this.bus.readByte(offset + i, false));
                }

                // this.cpu.stallCycle += 514;

                break;
        }
    }

    public load(address: number): number {
        address = address & 0x3FFF;  // just in case

        // 0x0000 - 0x1FFF is mapped with cartridge's CHR-ROM if it exists

        if (address < 0x2000 && this.hasChrRom) {
            return this.bus.readByte(address, false);
        }

        // 0x0000 - 0x0FFF: pattern table 0
        // 0x1000 - 0x1FFF: pattern table 1
        // 0x2000 - 0x23FF: nametable 0
        // 0x2400 - 0x27FF: nametable 1
        // 0x2800 - 0x2BFF: nametable 2
        // 0x2C00 - 0x2FFF: nametable 3
        // 0x3000 - 0x3EFF: Mirrors of 0x2000 - 0x2EFF
        // 0x3F00 - 0x3F1F: Palette RAM indices
        // 0x3F20 - 0x3FFF: Mirrors of 0x3F00 - 0x3F1F

        if (address >= 0x2000 && address < 0x3F00) {
            return this.vRam.load(this.getNameTableAddressWithMirroring(address & 0x2FFF));
        }

        if (address >= 0x3F00 && address < 0x4000) {
            address = address & 0x3F1F;
        }

        // Addresses for palette
        // 0x3F10/0x3F14/0x3F18/0x3F1C are mirrors of
        // 0x3F00/0x3F04/0x3F08/0x3F0C.

        if (address === 0x3F10) {
            address = 0x3F00;
        }

        if (address === 0x3F14) {
            address = 0x3F04;
        }

        if (address === 0x3F18) {
            address = 0x3F08;
        }

        if (address === 0x3F1C) {
            address = 0x3F0C;
        }

        // TODO: remove >> 4 workaround
        return this.vRam.load(address >> 4);
    }

    public store(address: number, value: number) {
        address = address & 0x3FFF;  // just in case

        // 0x0000 - 0x1FFF is mapped with cartridge's CHR-ROM if it exists

        if (address < 0x2000 && this.hasChrRom === true) {
            this.bus.write(address, value);
            return;
        }

        // 0x0000 - 0x0FFF: pattern table 0
        // 0x1000 - 0x1FFF: pattern table 1
        // 0x2000 - 0x23FF: nametable 0
        // 0x2400 - 0x27FF: nametable 1
        // 0x2800 - 0x2BFF: nametable 2
        // 0x2C00 - 0x2FFF: nametable 3
        // 0x3000 - 0x3EFF: Mirrors of 0x2000 - 0x2EFF
        // 0x3F00 - 0x3F1F: Palette RAM indices
        // 0x3F20 - 0x3FFF: Mirrors of 0x3F00 - 0x3F1F

        if (address >= 0x2000 && address < 0x3F00) {
            this.vRam.store(this.getNameTableAddressWithMirroring(address & 0x2FFF), value);
            return;
        }

        if (address >= 0x3F00 && address < 0x4000) {
            address = address & 0x3F1F;
        }

        if (address === 0x3F10) {
            address = 0x3F00;
        }

        if (address === 0x3F14) {
            address = 0x3F04;
        }

        if (address === 0x3F18) {
            address = 0x3F08;
        }

        if (address === 0x3F1C) {
            address = 0x3F0C;
        }

        return this.vRam.store(address, value);
    }

    public getNameTableAddressWithMirroring(address: number) {
        address = address & 0x2FFF;

        let baseAddress = 0;

        switch (this.mirroringType) {
            case MirroringType.SINGLE_SCREEN:
                baseAddress = 0x2000;
                break;

            case MirroringType.HORIZONTAL:
                if (address >= 0x2000 && address < 0x2400) {
                    baseAddress = 0x2000;
                } else if (address >= 0x2400 && address < 0x2800) {
                    baseAddress = 0x2000;
                } else if (address >= 0x2800 && address < 0x2C00) {
                    baseAddress = 0x2400;
                } else {
                    baseAddress = 0x2400;
                }

                break;

            case MirroringType.VERTICAL:
                if (address >= 0x2000 && address < 0x2400) {
                    baseAddress = 0x2000;
                } else if (address >= 0x2400 && address < 0x2800) {
                    baseAddress = 0x2400;
                } else if (address >= 0x2800 && address < 0x2C00) {
                    baseAddress = 0x2000;
                } else {
                    baseAddress = 0x2400;
                }

                break;

            case MirroringType.FOUR_SCREEN:
                if (address >= 0x2000 && address < 0x2400) {
                    baseAddress = 0x2000;
                } else if (address >= 0x2400 && address < 0x2800) {
                    baseAddress = 0x2400;
                } else if (address >= 0x2800 && address < 0x2C00) {
                    baseAddress = 0x2800;
                } else {
                    baseAddress = 0x2C00;
                }

                break;
        }

        return baseAddress | (address & 0x3FF);
    }

    public getBackgroundPixel() {
        const offset = 15 - this.fineXScroll;

        const lsb = (this.patternTableHighRegister.loadBit(offset) << 1) |
            this.patternTableLowRegister.loadBit(offset);
        const msb = (this.attributeTableHighRegister.loadBit(offset) << 1) |
            this.attributeTableLowRegister.loadBit(offset);
        let index = (msb << 2) | lsb;

        if (this.ppumask.isGreyscale() === true) {
            index = index & 0x30;
        }

        return COLOR_PALETTES[this.load(0x3F00 + index)];
    }

    public fetch() {
        if (this.scanLine >= 240 && this.scanLine <= 260) {
            return;
        }

        if (this.cycle === 0) {
            return;
        }

        if ((this.cycle >= 257 && this.cycle <= 320) || this.cycle >= 337) {
            return;
        }

        switch ((this.cycle - 1) % 8) {
            case 0:
                this.fetchNameTable();
                break;

            case 2:
                this.fetchAttributeTable();
                break;

            case 4:
                this.fetchPatternTableLow();
                break;

            case 6:
                this.fetchPatternTableHigh();
                break;

            default:
                break;
        }

        if (this.cycle % 8 === 1) {
            this.nameTableRegister.store(this.nameTableLatch);
            this.attributeTableLowRegister.storeLowerByte(this.attributeTableLowLatch);
            this.attributeTableHighRegister.storeLowerByte(this.attributeTableHighLatch);
            this.patternTableLowRegister.storeLowerByte(this.patternTableLowLatch);
            this.patternTableHighRegister.storeLowerByte(this.patternTableHighLatch);
        }
    }

    // http://wiki.nesdev.com/w/index.php/PPU_scrolling
    public fetchNameTable() {
        this.nameTableLatch = this.load(0x2000 | (this.currentVRamAddress & 0x0FFF));
    }

    public fetchAttributeTable() {
        const v = this.currentVRamAddress;
        const address = 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07);

        const byte = this.load(address);

        const coarseX = v & 0x1F;
        const coarseY = (v >> 5) & 0x1F;

        const topbottom = (coarseY % 4) >= 2 ? 1 : 0; // bottom, top
        const rightleft = (coarseX % 4) >= 2 ? 1 : 0; // right, left

        const position = (topbottom << 1) | rightleft; // bottomright, bottomleft,
        // topright, topleft

        const value = (byte >> (position << 1)) & 0x3;
        const highBit = value >> 1;
        const lowBit = value & 1;

        this.attributeTableHighLatch = highBit === 1 ? 0xff : 0;
        this.attributeTableLowLatch = lowBit === 1 ? 0xff : 0;
    }

    public fetchPatternTableLow() {
        const fineY = (this.currentVRamAddress >> 12) & 0x7;
        const index = this.ppuctrl.getBackgroundPatternTableNum() * 0x1000 +
            this.nameTableRegister.load() * 0x10 + fineY;

        this.patternTableLowLatch = this.load(index);
    }

    public fetchPatternTableHigh() {
        const fineY = (this.currentVRamAddress >> 12) & 0x7;
        const index = this.ppuctrl.getBackgroundPatternTableNum() * 0x1000 +
            this.nameTableRegister.load() * 0x10 + fineY;

        this.patternTableHighLatch = this.load(index + 0x8);
    }

    public updateFlags() {
        if (this.cycle === 1) {
            if (this.scanLine === 241) {
                this.ppustatus.setVBlank();
                this.display.updateScreen();

                // if(this.ppuctrl.enabledNmi() === true)
                //  this.cpu.interrupt(this.cpu.INTERRUPTS.NMI);
            } else if (this.scanLine === 261) {
                this.ppustatus.clearVBlank();
                this.ppustatus.clearZeroHit();
                this.ppustatus.clearOverflow();
            }
        }

        if (this.cycle === 10) {
            if (this.scanLine === 241) {
                if (this.ppuctrl.enabledNmi() === true) {
                    this.cpu.handleNmi();
                }
            }
        }
    }

    public countUpScrollCounters() {
        if (this.ppumask.isBackgroundVisible() === false && this.ppumask.isSpritesVisible() === false) {
            return;
        }

        if (this.scanLine >= 240 && this.scanLine <= 260) {
            return;
        }

        if (this.scanLine === 261) {
            if (this.cycle >= 280 && this.cycle <= 304) {
                this.currentVRamAddress &= ~0x7BE0;
                this.currentVRamAddress |= (this.temporalVRamAddress & 0x7BE0);
            }
        }

        if (this.cycle === 0 || (this.cycle >= 258 && this.cycle <= 320)) {
            return;
        }

        if ((this.cycle % 8) === 0) {
            let v = this.currentVRamAddress;

            if ((v & 0x1F) === 31) {
                v &= ~0x1F;
                v ^= 0x400;
            } else {
                v++;
            }

            this.currentVRamAddress = v;
        }

        if (this.cycle === 256) {
            let v = this.currentVRamAddress;

            if ((v & 0x7000) !== 0x7000) {
                v += 0x1000;
            } else {
                v &= ~0x7000;
                let y = (v & 0x3E0) >> 5;

                if (y === 29) {
                    y = 0;
                    v ^= 0x800;
                } else if (y === 31) {
                    y = 0;
                } else {
                    y++;
                }

                v = (v & ~0x3E0) | (y << 5);
            }

            this.currentVRamAddress = v;
        }

        if (this.cycle === 257) {
            this.currentVRamAddress &= ~0x41F;
            this.currentVRamAddress |= (this.temporalVRamAddress & 0x41F);
        }
    }

    public countUpCycle() {
        this.cycle++;

        if (this.cycle > 340) {
            this.cycle = 0;
            this.scanLine++;

            if (this.scanLine > 261) {
                this.scanLine = 0;
                this.frame++;
            }
        }
    }

    public incrementVRamAddress() {
        this.currentVRamAddress += this.ppuctrl.isIncrementAddressSet() ? 32 : 1;
        this.currentVRamAddress &= 0x7FFF;
        this.ppuaddr.store(this.currentVRamAddress & 0xFF);
    }

    // https://wiki.nesdev.com/w/index.php/PPU_sprite_evaluation
    public evaluateSprites() {
        if (this.scanLine >= 240) {
            return;
        }

        if (this.cycle === 0) {
            this.processSpritePixels();

            for (let i = 0, il = this.oamRam2.getCapacity(); i < il; i++) {
                this.oamRam2.store(i, 0xFF);
            }
        } else if (this.cycle === 65) {
            const height = this.ppuctrl.isSpriteSize16() ? 16 : 8;
            let n = 0;

            for (let i = 0, il = this.spritesManager.getNum(); i < il; i++) {
                const s = this.spritesManager.get(i);

                if (s.on(this.scanLine, height) === true) {
                    if (n < 8) {
                        this.spritesManager2.copy(n++, s);
                    } else {
                        this.ppustatus.setOverflow();
                        break;
                    }
                }
            }
        }
    }

    public processSpritePixels() {
        const ay = this.scanLine - 1;

        for (let i = 0, il = this.spritePixels.length; i < il; i++) {
            this.spritePixels[i] = -1;
            this.spriteIds[i] = -1;
            this.spritePriorities[i] = -1;
        }

        const height = this.ppuctrl.isSpriteSize16() === true ? 16 : 8;
        const n = 0;

        for (let i = 0, il = this.spritesManager2.getNum(); i < il; i++) {
            const s = this.spritesManager2.get(i);

            if (s.isEmpty()) {
                break;
            }

            const bx = s.getXPosition();
            const by = s.getYPosition();
            const j = ay - by;
            const cy = s.doFlipVertically() ? height - j - 1 : j;
            const horizontal = s.doFlipHorizontally();
            const ptIndex = (height === 8) ? s.getTileIndex() : s.getTileIndexForSize16();
            const msb = s.getPalletNum();

            for (let k = 0; k < 8; k++) {
                const cx = horizontal ? 7 - k : k;
                const x = bx + k;

                if (x >= 256) {
                    break;
                }

                const lsb = this.getPatternTableElement(ptIndex, cx, cy, height);

                if (lsb !== 0) {
                    const pIndex = (msb << 2) | lsb;

                    if (this.spritePixels[x] === -1) {
                        this.spritePixels[x] = COLOR_PALETTES[this.load(0x3F10 + pIndex)];
                        this.spriteIds[x] = s.getId();
                        this.spritePriorities[x] = s.getPriority();
                    }
                }
            }
        }
    }

    public getPatternTableElement(index: number, x: number, y: number, ySize: number): number {
        const ax = x % 8;
        let a;
        let b;

        if (ySize === 8) {
            const ay = y % 8;
            const offset = this.ppuctrl.getSpritesPatternTableNum() === 1 ? 0x1000 : 0;
            a = this.load(offset + index * 0x10 + ay);
            b = this.load(offset + index * 0x10 + 0x8 + ay);
        } else {
            let ay = y % 8;
            ay += (y >> 3) * 0x10;
            a = this.load(index + ay);
            b = this.load(index + ay + 0x8);
        }

        return ((a >> (7 - ax)) & 1) | (((b >> (7 - ax)) & 1) << 1);
    }

    public dump(): string {
        let buffer = '';

        buffer += 'PPU Ctrl: ' + this.ppuctrl.dump() + '\n';
        buffer += 'PPU Mask: ' + this.ppumask.dump() + '\n';
        buffer += 'PPU Status: ' + this.ppustatus.dump() + '\n';
        buffer += 'OAM Address: ' + this.oamaddr.dump() + '\n';
        buffer += 'OAM Data: ' + this.oamdata.dump() + '\n';
        buffer += 'PPU Scroll: ' + this.ppuscroll.dump() + '\n';
        buffer += 'PPU Addr: ' + this.ppuaddr.dump() + '\n';
        buffer += 'PPU Data: ' + this.ppudata.dump() + '\n';
        buffer += 'OAM DMA: ' + this.oamdma.dump() + '\n';
        buffer += '\n';

        return buffer;
    }

    public dumpVRAM(): string {
        let buffer = '';
        let previousIsZeroLine = false;
        const offset = 0;
        const end = 0x10000;

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

            const value = this.load(i);
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

    private _checkNext16BytesIsZero(offset: number): boolean {
        if (offset + 0x10 >= 0x10000) {
            return false;
        }

        let sum = 0;
        for (let i = offset; i < offset + 0x10; i++) {
            sum += this.load(i);
        }

        return sum === 0;
    }

    public dumpSPRRAM(): string {
        return this.oamRam.dump();
    }
}

export class PpuControlRegister extends Register8bit {
    private static NMI_VBLANK_BIT = 7;
    private static MASTER_SLAVE_BIT = 6;
    private static SPRITES_SIZE_BIT = 5;
    private static BACKGROUND_PATTERN_TABLE_BIT = 4;
    private static SPRITES_PATTERN_TABLE_BIT = 3;
    private static INCREMENT_ADDRESS_BIT = 2;

    private static NAME_TABLE_ADDRESS_BIT = 0;
    private static NAME_TABLE_ADDRESS_BITS_WIDTH = 2;

    public isIncrementAddressSet(): boolean {
        return this.isBitSet(PpuControlRegister.INCREMENT_ADDRESS_BIT);
    }

    public enabledNmi(): boolean {
        return this.isBitSet(PpuControlRegister.NMI_VBLANK_BIT);
    }

    public isSpriteSize16(): boolean {
        return this.isBitSet(PpuControlRegister.SPRITES_SIZE_BIT);
    }

    public getBackgroundPatternTableNum(): number {
        return this.loadBit(PpuControlRegister.BACKGROUND_PATTERN_TABLE_BIT);
    }

    public getSpritesPatternTableNum(): number {
        return this.loadBit(PpuControlRegister.SPRITES_PATTERN_TABLE_BIT);
    }

    public getNameTableAddress(): number {
        return this.loadBits(PpuControlRegister.NAME_TABLE_ADDRESS_BIT, PpuControlRegister.NAME_TABLE_ADDRESS_BITS_WIDTH);
    }
}

export class PpuMaskRegister extends Register8bit {

    private static GREYSCALE_BIT = 0;
    private static LEFTMOST_BACKGROUND_VISIBLE_BIT = 1;
    private static LEFTMOST_SPRITES_VISIBLE_BIT = 2;
    private static BACKGROUND_VISIBLE_BIT = 3;
    private static SPRITES_VISIBLE_BIT = 4;
    private static EMPHASIZE_RED_BIT = 5;
    private static EMPHASIZE_GREEN_BIT = 6;
    private static EMPHASIZE_BLUE_BIT = 7;

    public isGreyscale() {
        return this.isBitSet(PpuMaskRegister.GREYSCALE_BIT);
    }

    public isLeftMostBackgroundVisible() {
        return this.isBitSet(PpuMaskRegister.LEFTMOST_BACKGROUND_VISIBLE_BIT);
    }

    public isLeftMostSpritesVisible() {
        return this.isBitSet(PpuMaskRegister.LEFTMOST_SPRITES_VISIBLE_BIT);
    }

    public isBackgroundVisible() {
        return this.isBitSet(PpuMaskRegister.BACKGROUND_VISIBLE_BIT);
    }

    public isSpritesVisible() {
        return this.isBitSet(PpuMaskRegister.SPRITES_VISIBLE_BIT);
    }

    public emphasisRed() {
        return this.isBitSet(PpuMaskRegister.EMPHASIZE_RED_BIT);
    }

    public emphasisGreen() {
        return this.isBitSet(PpuMaskRegister.EMPHASIZE_GREEN_BIT);
    }

    public emphasisBlue() {
        return this.isBitSet(PpuMaskRegister.EMPHASIZE_BLUE_BIT);
    }
}

export class PpuStatusRegister extends Register8bit {
    private static VBLANK_BIT = 7;
    private static SPRITE_ZERO_HIT_BIT = 6;
    private static SPRITE_OVERFLOW_BIT = 5;

    public setVBlank() {
        this.setBit(PpuStatusRegister.VBLANK_BIT);
    }

    public clearVBlank() {
        this.clearBit(PpuStatusRegister.VBLANK_BIT);
    }

    public setZeroHit() {
        this.setBit(PpuStatusRegister.SPRITE_ZERO_HIT_BIT);
    }

    public clearZeroHit() {
        this.clearBit(PpuStatusRegister.SPRITE_ZERO_HIT_BIT);
    }

    public setOverflow() {
        this.setBit(PpuStatusRegister.SPRITE_OVERFLOW_BIT);
    }

    public clearOverflow() {
        this.clearBit(PpuStatusRegister.SPRITE_OVERFLOW_BIT);
    }
}

export class SpritesManager {

    private sprites: Sprite[];

    constructor(memory: Memory) {
        this.sprites = [];
        this.init(memory);
    }

    public init(memory: Memory): void {
        for (let i = 0, il = memory.getCapacity() / 4; i < il; i++) {
            this.sprites.push(new Sprite(i, i, memory));
        }
    }

    public getNum(): number {
        return this.sprites.length;
    }

    public get(index: number): Sprite {
        return this.sprites[index];
    }

    public copy(index: number, sprite: Sprite): void {
        this.sprites[index].copy(sprite);
    }
}

export class Sprite {

    private index: number;
    private id: number;
    private memory: Memory;

    constructor(index: number, id: number, memory: Memory) {
        this.index = index;
        this.id = id;
        this.memory = memory;
    }

    public getId(): number {
        return this.id;
    }

    public setId(id: number): void {
        this.id = id;
    }

    public getByte0(): number {
        return this.memory.load(this.index * 4);
    }

    public getByte1(): number {
        return this.memory.load(this.index * 4 + 1);
    }

    public getByte2(): number {
        return this.memory.load(this.index * 4 + 2);
    }

    public getByte3(): number {
        return this.memory.load(this.index * 4 + 3);
    }

    public setByte0(value: number): void {
        this.memory.store(this.index * 4, value);
    }

    public setByte1(value: number): void {
        this.memory.store(this.index * 4 + 1, value);
    }

    public setByte2(value: number): void {
        this.memory.store(this.index * 4 + 2, value);
    }

    public setByte3(value: number): void {
        this.memory.store(this.index * 4 + 3, value);
    }

    public copy(sprite: Sprite): void {
        this.setId(sprite.getId());
        this.setByte0(sprite.getByte0());
        this.setByte1(sprite.getByte1());
        this.setByte2(sprite.getByte2());
        this.setByte3(sprite.getByte3());
    }

    public isEmpty(): boolean {
        return this.getByte0() === 0xFF && this.getByte1() === 0xFF &&
            this.getByte2() === 0xFF && this.getByte3() === 0xFF;
    }

    public isVisible(): boolean {
        return this.getByte0() < 0xEF;
    }

    public getYPosition(): number {
        return this.getByte0() - 1;
    }

    public getXPosition(): number {
        return this.getByte3();
    }

    public getTileIndex(): number {
        return this.getByte1();
    }

    public getTileIndexForSize16(): number {
        return ((this.getByte1() & 1) * 0x1000) + (this.getByte1() >> 1) * 0x20;
    }

    public getPalletNum(): number {
        return this.getByte2() & 0x3;
    }

    public getPriority(): number {
        return (this.getByte2() >> 5) & 1;
    }

    public doFlipHorizontally(): boolean {
        return !!((this.getByte2() >> 6) & 1);
    }

    public doFlipVertically(): boolean {
        return !!((this.getByte2() >> 7) & 1);
    }

    public on(y: number, length: number): boolean {
        return (y >= this.getYPosition()) && (y < this.getYPosition() + length);
    }
}
