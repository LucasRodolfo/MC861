import {Register8bit, Register16bit} from './Register.js';
import {Memory} from './Memory.js';
import {Utility} from './Utility.js';
import {Bus} from './Bus';

// https://wiki.nesdev.com/w/index.php/PPU
export class Ppu {

    private _bus: Bus;

    private frame: number = 0;

    private scanLine: number = 0;
    private cycle: number = 0;

    // inside memory

    private vRam = new Memory(16 * 1024);  // 16KB
    private oamRam = new Memory(256);      // 256B, primary OAM memory
    private oamRam2 = new Memory(32);      // 32B, secondary OAM memory

    // CPU memory mapped registers

    private ppuctrl = new PpuControlRegister();  // 0x2000
    private ppumask = new PpuMaskRegister();     // 0x2001
    private ppustatus = new PpuStatusRegister(); // 0x2002
    private oamaddr: number;        // 0x2003
    private oamdata: number;        // 0x2004
    private ppuscroll: number;      // 0x2005
    private ppuaddr: number;        // 0x2006
    private ppudata: number;        // 0x2007
    private oamdma: number;         // 0x4014

    // inside shift registers

    private nameTableRegister: number;
    private attributeTableLowRegister: number;
    private attributeTableHighRegister: number;
    private patternTableLowRegister: number;
    private patternTableHighRegister: number;

    // inside latches

    private nameTableLatch = 0;
    private attributeTableLowLatch = 0;
    private attributeTableHighLatch = 0;
    private patternTableLowLatch = 0;
    private patternTableHighLatch = 0

    //

    private fineXScroll = 0;
    private currentVRamAddress = 0;
    private temporalVRamAddress = 0;

    //

    private vRamReadBuffer = 0;
    private registerFirstStore = true;

    constructor(bus = new Bus()) {
        this.bus = bus;
    }

    get bus(): Bus {
        return this._bus;
    }

    set bus(value: Bus) {
        this._bus = value;
    }

    public init(): void {

        this.ppustatus = 0x80;

        // sprites

        this.spritesManager = new SpritesManager(this.oamRam);
        this.spritesManager2 = new SpritesManager(this.oamRam2);

        // for one scan line

        this.spritePixels = [];
        this.spriteIds = [];
        this.spritePriorities = [];

        for(var i = 0; i < 256; i++) {
            this.spritePixels[i] = -1;
            this.spriteIds[i] = -1;
            this.spritePriorities[i] = -1;
        }
    }
}

/**
 * RP2A03
 * Refer to https://wiki.nesdev.com/w/index.php/PPU
 */
function Ppu() {
}

//


//

Object.assign(Ppu.prototype, {
    isPpu: true,

    //

    /**
     * Refer to https://wiki.nesdev.com/w/index.php/PPU_power_up_state
     */
    bootup: function() {
        this.ppustatus.store(0x80);
    },

    /**
     *
     */
    reset: function() {

    },

    /**
     *
     */
    runCycle: function() {
        this.renderPixel();
        this.shiftRegisters();
        this.fetch();
        this.evaluateSprites();
        this.updateFlags();
        this.countUpScrollCounters();
        this.countUpCycle();
    },

    // load/store methods

    /**
     * Called from Cpu
     */
    loadRegister: function(address) {
        switch(address) {

            // ppustatus load

            case 0x2002:
                var value = this.ppustatus.load();
                this.ppustatus.clearVBlank();
                this.registerFirstStore = true;
                return value;

            // oamdata load

            case 0x2004:
                return this.oamRam.load(this.oamaddr.load());

            // ppudata load

            case 0x2007:
                var value;

                if((this.currentVRamAddress & 0x3FFF) >= 0 &&
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

        return 0;
    },

    /**
     * Called from Cpu.
     */
    storeRegister: function(address, value) {
        switch(address) {

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

                if(this.registerFirstStore === true) {
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
                if(this.registerFirstStore === true) {
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

                var offset = value * 0x100;

                for(var i = this.oamaddr.load(); i < 256; i++)
                    this.oamRam.store(i, this.cpu.load(offset + i));

                this.cpu.stallCycle += 514;

                break;
        }
    },

    /**
     *
     */
    load: function(address) {
        address = address & 0x3FFF;  // just in case

        // 0x0000 - 0x1FFF is mapped with cartridge's CHR-ROM if it exists

        if(address < 0x2000 && this.rom.hasChrRom() === true)
            return this.rom.load(address);

        // 0x0000 - 0x0FFF: pattern table 0
        // 0x1000 - 0x1FFF: pattern table 1
        // 0x2000 - 0x23FF: nametable 0
        // 0x2400 - 0x27FF: nametable 1
        // 0x2800 - 0x2BFF: nametable 2
        // 0x2C00 - 0x2FFF: nametable 3
        // 0x3000 - 0x3EFF: Mirrors of 0x2000 - 0x2EFF
        // 0x3F00 - 0x3F1F: Palette RAM indices
        // 0x3F20 - 0x3FFF: Mirrors of 0x3F00 - 0x3F1F

        if(address >= 0x2000 && address < 0x3F00)
            return this.vRam.load(this.getNameTableAddressWithMirroring(address & 0x2FFF));

        if(address >= 0x3F00 && address < 0x4000)
            address = address & 0x3F1F;

        // Addresses for palette
        // 0x3F10/0x3F14/0x3F18/0x3F1C are mirrors of
        // 0x3F00/0x3F04/0x3F08/0x3F0C.

        if(address === 0x3F10)
            address = 0x3F00;

        if(address === 0x3F14)
            address = 0x3F04;

        if(address === 0x3F18)
            address = 0x3F08;

        if(address === 0x3F1C)
            address = 0x3F0C;

        return this.vRam.load(address);
    },

    /**
     *
     */
    store: function(address, value) {
        address = address & 0x3FFF;  // just in case

        // 0x0000 - 0x1FFF is mapped with cartridge's CHR-ROM if it exists

        if(address < 0x2000 && this.rom.hasChrRom() === true) {
            this.rom.store(address, value);
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

        if(address >= 0x2000 && address < 0x3F00) {
            this.vRam.store(this.getNameTableAddressWithMirroring(address & 0x2FFF), value);
            return;
        }

        if(address >= 0x3F00 && address < 0x4000)
            address = address & 0x3F1F;

        // Addresses for palette
        // 0x3F10/0x3F14/0x3F18/0x3F1C are mirrors of
        // 0x3F00/0x3F04/0x3F08/0x3F0C.

        if(address === 0x3F10)
            address = 0x3F00;

        if(address === 0x3F14)
            address = 0x3F04;

        if(address === 0x3F18)
            address = 0x3F08;

        if(address === 0x3F1C)
            address = 0x3F0C;

        return this.vRam.store(address, value);
    },

    // private methods

    getNameTableAddressWithMirroring: function(address) {
        address = address & 0x2FFF;  // just in case

        var baseAddress = 0;

        switch(this.rom.getMirroringType()) {
            case this.rom.MIRRORINGS.SINGLE_SCREEN:
                baseAddress = 0x2000;
                break;

            case this.rom.MIRRORINGS.HORIZONTAL:
                if(address >= 0x2000 && address < 0x2400)
                    baseAddress = 0x2000;
                else if(address >= 0x2400 && address < 0x2800)
                    baseAddress = 0x2000;
                else if(address >= 0x2800 && address < 0x2C00)
                    baseAddress = 0x2400;
                else
                    baseAddress = 0x2400;

                break;

            case this.rom.MIRRORINGS.VERTICAL:
                if(address >= 0x2000 && address < 0x2400)
                    baseAddress = 0x2000;
                else if(address >= 0x2400 && address < 0x2800)
                    baseAddress = 0x2400;
                else if(address >= 0x2800 && address < 0x2C00)
                    baseAddress = 0x2000;
                else
                    baseAddress = 0x2400;

                break;

            case this.rom.MIRRORINGS.FOUR_SCREEN:
                if(address >= 0x2000 && address < 0x2400)
                    baseAddress = 0x2000;
                else if(address >= 0x2400 && address < 0x2800)
                    baseAddress = 0x2400;
                else if(address >= 0x2800 && address < 0x2C00)
                    baseAddress = 0x2800;
                else
                    baseAddress = 0x2C00;

                break;
        }

        return baseAddress | (address & 0x3FF);
    },

    // rendering

    /**
     *
     */
    renderPixel: function() {
        // Note: this comparison order is for performance.
        if(this.cycle >= 257 || this.scanLine >= 240 || this.cycle === 0)
            return;

        var x = this.cycle - 1 ;
        var y = this.scanLine;

        var backgroundVisible = this.ppumask.isBackgroundVisible();
        var spritesVisible = this.ppumask.isSpritesVisible();

        var backgroundPixel = this.getBackgroundPixel();
        var spritePixel = this.spritePixels[x];
        var spriteId = this.spriteIds[x];
        var spritePriority = this.spritePriorities[x];

        var c = this.COLOR_PALETTES[this.load(0x3F00)];

        // TODO: fix me

        if(backgroundVisible === true && spritesVisible === true) {
            if(spritePixel === -1) {
                c = backgroundPixel;
            } else {
                if(backgroundPixel === c)
                    c = spritePixel
                else
                    c = spritePriority === 0 ? spritePixel : backgroundPixel;
            }
        } else if(backgroundVisible === true && spritesVisible === false) {
            c = backgroundPixel;
        } else if(backgroundVisible === false && spritesVisible === true) {
            if(spritePixel !== -1)
                c = spritePixel;
        }

        // TODO: fix me

        if(this.ppumask.emphasisRed() === true)
            c = c | 0x00FF0000;
        if(this.ppumask.emphasisGreen() === true)
            c = c | 0x0000FF00;
        if(this.ppumask.emphasisBlue() === true)
            c = c | 0x000000FF;

        // TODO: fix me

        if(backgroundVisible === true && spritesVisible === true &&
            spriteId === 0 && spritePixel !== 0 && backgroundPixel !== 0)
            this.ppustatus.setZeroHit();

        this.display.renderPixel(x, y, c);
    },

    /**
     *
     */
    getBackgroundPixel: function() {
        var offset = 15 - this.fineXScroll;

        var lsb = (this.patternTableHighRegister.loadBit(offset) << 1) |
            this.patternTableLowRegister.loadBit(offset);
        var msb = (this.attributeTableHighRegister.loadBit(offset) << 1) |
            this.attributeTableLowRegister.loadBit(offset);
        var index = (msb << 2) | lsb;

        // TODO: fix me
f
        if(this.ppumask.isGreyscale() === true)
            index = index & 0x30;

        return this.COLOR_PALETTES[this.load(0x3F00 + index)];
    },

    //

    /**
     *
     */
    shiftRegisters: function() {
        if(this.scanLine >= 240 && this.scanLine <= 260)
            return;

        if((this.cycle >= 1 && this.cycle <= 256) ||
            (this.cycle >= 329 && this.cycle <= 336)) {
            this.patternTableLowRegister.shift(0);
            this.patternTableHighRegister.shift(0);
            this.attributeTableLowRegister.shift(0);
            this.attributeTableHighRegister.shift(0);
        }
    },

    // fetch

    /**
     *
     */
    fetch: function() {
        if(this.scanLine >= 240 && this.scanLine <= 260)
            return;

        if(this.cycle === 0)
            return;

        if((this.cycle >= 257 && this.cycle <= 320) || this.cycle >= 337)
            return;

        switch((this.cycle - 1) % 8) {
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

        if(this.cycle % 8 === 1) {
            this.nameTableRegister.store(this.nameTableLatch);
            this.attributeTableLowRegister.storeLowerByte(this.attributeTableLowLatch);
            this.attributeTableHighRegister.storeLowerByte(this.attributeTableHighLatch);
            this.patternTableLowRegister.storeLowerByte(this.patternTableLowLatch);
            this.patternTableHighRegister.storeLowerByte(this.patternTableHighLatch);
        }
    },

    /**
     * Refer to http://wiki.nesdev.com/w/index.php/PPU_scrolling
     */
    fetchNameTable: function() {
        this.nameTableLatch = this.load(0x2000 | (this.currentVRamAddress & 0x0FFF));
    },

    /**
     *
     */
    fetchAttributeTable: function() {
        var v = this.currentVRamAddress;
        var address = 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07);

        var byte = this.load(address);

        var coarseX = v & 0x1F;
        var coarseY = (v >> 5) & 0x1F

        var topbottom = (coarseY % 4) >= 2 ? 1 : 0; // bottom, top
        var rightleft = (coarseX % 4) >= 2 ? 1 : 0; // right, left

        var position = (topbottom << 1) | rightleft; // bottomright, bottomleft,
                                                     // topright, topleft

        var value = (byte >> (position << 1)) & 0x3;
        var highBit = value >> 1;
        var lowBit = value & 1;

        this.attributeTableHighLatch = highBit === 1 ? 0xff : 0;
        this.attributeTableLowLatch = lowBit === 1 ? 0xff : 0;
    },

    /**
     *
     */
    fetchPatternTableLow: function() {
        var fineY = (this.currentVRamAddress >> 12) & 0x7;
        var index = this.ppuctrl.getBackgroundPatternTableNum() * 0x1000 +
            this.nameTableRegister.load() * 0x10 + fineY;

        this.patternTableLowLatch = this.load(index);
    },

    /**
     *
     */
    fetchPatternTableHigh: function() {
        var fineY = (this.currentVRamAddress >> 12) & 0x7;
        var index = this.ppuctrl.getBackgroundPatternTableNum() * 0x1000 +
            this.nameTableRegister.load() * 0x10 + fineY;

        this.patternTableHighLatch = this.load(index + 0x8);
    },

    //

    /**
     *
     */
    updateFlags: function() {
        if(this.cycle === 1) {
            if(this.scanLine === 241) {
                this.ppustatus.setVBlank();
                this.display.updateScreen();

                //if(this.ppuctrl.enabledNmi() === true)
                //  this.cpu.interrupt(this.cpu.INTERRUPTS.NMI);
            } else if(this.scanLine === 261) {
                this.ppustatus.clearVBlank();
                this.ppustatus.clearZeroHit();
                this.ppustatus.clearOverflow();
            }
        }

        if(this.cycle === 10) {
            if(this.scanLine === 241) {
                if(this.ppuctrl.enabledNmi() === true)
                    this.cpu.interrupt(this.cpu.INTERRUPTS.NMI);
            }
        }

        // @TODO: check this driving IRQ counter for MMC3Mapper timing is correct

        if(this.rom.mapper.isMMC3Mapper === true) {
            if(this.cycle === 340 && this.scanLine <= 240 &&
                this.ppumask.isBackgroundVisible() === true &&
                this.ppumask.isSpritesVisible() === true)
                this.rom.mapper.driveIrqCounter(this.cpu);
        }
    },

    /**
     *
     */
    countUpScrollCounters: function() {
        if(this.ppumask.isBackgroundVisible() === false && this.ppumask.isSpritesVisible() === false)
            return;

        if(this.scanLine >= 240 && this.scanLine <= 260)
            return;

        if(this.scanLine === 261) {
            if(this.cycle >= 280 && this.cycle <= 304) {
                this.currentVRamAddress &= ~0x7BE0;
                this.currentVRamAddress |= (this.temporalVRamAddress & 0x7BE0)
            }
        }

        if(this.cycle === 0 || (this.cycle >= 258 && this.cycle <= 320))
            return;

        if((this.cycle % 8) === 0) {
            var v = this.currentVRamAddress;

            if((v & 0x1F) === 31) {
                v &= ~0x1F;
                v ^= 0x400;
            } else {
                v++;
            }

            this.currentVRamAddress = v;
        }

        if(this.cycle === 256) {
            var v = this.currentVRamAddress;

            if((v & 0x7000) !== 0x7000) {
                v += 0x1000;
            } else {
                v &= ~0x7000;
                var y = (v & 0x3E0) >> 5;

                if(y === 29) {
                    y = 0;
                    v ^= 0x800;
                } else if(y === 31) {
                    y = 0;
                } else {
                    y++;
                }

                v = (v & ~0x3E0) | (y << 5);
            }

            this.currentVRamAddress = v;
        }

        if(this.cycle === 257) {
            this.currentVRamAddress &= ~0x41F;
            this.currentVRamAddress |= (this.temporalVRamAddress & 0x41F)
        }
    },

    /**
     * cycle:    0 - 340
     * scanLine: 0 - 261
     */
    countUpCycle: function() {
        this.cycle++;

        if(this.cycle > 340) {
            this.cycle = 0;
            this.scanLine++;

            if(this.scanLine > 261) {
                this.scanLine = 0;
                this.frame++;
            }
        }
    },

    //

    /**
     *
     */
    incrementVRamAddress: function() {
        this.currentVRamAddress += this.ppuctrl.isIncrementAddressSet() ? 32 : 1;
        this.currentVRamAddress &= 0x7FFF;
        this.ppuaddr.store(this.currentVRamAddress & 0xFF);
    },

    // sprites

    /**
     * Refer to https://wiki.nesdev.com/w/index.php/PPU_sprite_evaluation
     */
    evaluateSprites: function() {
        if(this.scanLine >= 240)
            return;

        if(this.cycle === 0) {
            this.processSpritePixels();

            for(var i = 0, il = this.oamRam2.getCapacity(); i < il; i++)
                this.oamRam2.store(i, 0xFF);
        } else if(this.cycle === 65) {
            var height = this.ppuctrl.isSpriteSize16() ? 16 : 8;
            var n = 0;

            for(var i = 0, il = this.spritesManager.getNum(); i < il; i++) {
                var s = this.spritesManager.get(i);

                if(s.on(this.scanLine, height) === true) {
                    if(n < 8) {
                        this.spritesManager2.copy(n++, s);
                    } else {
                        this.ppustatus.setOverflow();
                        break;
                    }
                }
            }
        }
    },

    /**
     *
     */
    processSpritePixels: function() {
        var ay = this.scanLine - 1;

        for(var i = 0, il = this.spritePixels.length; i < il; i++) {
            this.spritePixels[i] = -1;
            this.spriteIds[i] = -1;
            this.spritePriorities[i] = -1;
        }

        var height = this.ppuctrl.isSpriteSize16() === true ? 16 : 8;
        var n = 0;

        for(var i = 0, il = this.spritesManager2.getNum(); i < il; i++) {
            var s = this.spritesManager2.get(i);

            if(s.isEmpty())
                break;

            var bx = s.getXPosition();
            var by = s.getYPosition();
            var j = ay - by;
            var cy = s.doFlipVertically() ? height - j - 1 : j;
            var horizontal = s.doFlipHorizontally();
            var ptIndex = (height === 8) ? s.getTileIndex() : s.getTileIndexForSize16();
            var msb = s.getPalletNum();

            for(var k = 0; k < 8; k++) {
                var cx = horizontal ? 7 - k : k;
                var x = bx + k;

                if(x >= 256)
                    break;

                var lsb = this.getPatternTableElement(ptIndex, cx, cy, height);

                if(lsb !== 0) {
                    var pIndex = (msb << 2) | lsb;

                    if(this.spritePixels[x] === -1) {
                        this.spritePixels[x] = this.COLOR_PALETTES[this.load(0x3F10 + pIndex)];
                        this.spriteIds[x] = s.getId();
                        this.spritePriorities[x] = s.getPriority();
                    }
                }
            }
        }
    },

    /**
     *
     */
    getPatternTableElement: function(index, x, y, ySize) {
        var ax = x % 8;
        var a, b;

        if(ySize === 8) {
            var ay = y % 8;
            var offset = this.ppuctrl.getSpritesPatternTableNum() === 1 ? 0x1000 : 0;
            a = this.load(offset + index * 0x10 + ay);
            b = this.load(offset + index * 0x10 + 0x8 + ay);
        } else {
            var ay = y % 8;
            ay += (y >> 3) * 0x10;
            a = this.load(index + ay);
            b = this.load(index + ay + 0x8);
        }

        return ((a >> (7 - ax)) & 1) | (((b >> (7 - ax)) & 1) << 1);
    },

    // dump methods

    /**
     *
     */
    dump: function() {
        var buffer = '';

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
    },

    /**
     *
     */
    dumpVRAM: function() {
        var buffer = '';
        var previousIsZeroLine = false;
        var offset = 0;
        var end = 0x10000;

        for(var i = offset; i < end; i++) {
            if(i % 0x10 == 0) {
                if(previousIsZeroLine) {
                    var skipZero = false;
                    while(this._checkNext16BytesIsZero(i+0x10)) {
                        i += 0x10;
                        skipZero = true;
                    }
                    if(skipZero)
                        buffer += '...\n';
                }
                buffer += Utility.convertDecToHexString(i-offset, 4) + ' ';
                previousIsZeroLine = true;
            }

            var value = this.load(i);
            buffer += Utility.convertDecToHexString(value, 2, true) + ' ';
            if(value != 0)
                previousIsZeroLine = false;

            if(i % 0x10 == 0xf)
                buffer += '\n';
        }
        return buffer;
    },

    /**
     *
     */
    _checkNext16BytesIsZero: function(offset) {
        if(offset + 0x10 >= 0x10000)
            return false;

        var sum = 0;
        for(var i = offset; i < offset + 0x10; i++) {
            sum += this.load(i);
        }
        return sum == 0;
    },

    /**
     *
     */
    dumpSPRRAM: function() {
        return this.oamRam.dump();
    }
});

/**
 *
 */
function PpuControlRegister() {
    Register8bit.call(this);
}

PpuControlRegister.prototype = Object.assign(Object.create(Register8bit.prototype), {
    isPpuControlRegister: true,

    //

    NMI_VBLANK_BIT: 7,
    MASTER_SLAVE_BIT: 6,
    SPRITES_SIZE_BIT: 5,
    BACKGROUND_PATTERN_TABLE_BIT: 4,
    SPRITES_PATTERN_TABLE_BIT: 3,
    INCREMENT_ADDRESS_BIT: 2,

    NAME_TABLE_ADDRESS_BIT: 0,
    NAME_TABLE_ADDRESS_BITS_WIDTH: 2,

    //

    /**
     *
     */
    isIncrementAddressSet: function() {
        return this.isBitSet(this.INCREMENT_ADDRESS_BIT);
    },

    /**
     *
     */
    enabledNmi: function() {
        return this.isBitSet(this.NMI_VBLANK_BIT);
    },

    /**
     *
     */
    isSpriteSize16: function() {
        return this.isBitSet(this.SPRITES_SIZE_BIT);
    },

    /**
     *
     */
    getBackgroundPatternTableNum: function() {
        return this.loadBit(this.BACKGROUND_PATTERN_TABLE_BIT);
    },

    /**
     *
     */
    getSpritesPatternTableNum: function() {
        return this.loadBit(this.SPRITES_PATTERN_TABLE_BIT);
    },

    /**
     *
     */
    getNameTableAddress: function() {
        return this.loadBits(this.NAME_TABLE_ADDRESS_BIT, this.NAME_TABLE_ADDRESS_BITS_WIDTH);
    }
});

/**
 *
 */
function PpuMaskRegister() {
    Register8bit.call(this);
}

PpuMaskRegister.prototype = Object.assign(Object.create(Register8bit.prototype), {
    isPpuMaskRegister: true,

    //

    GREYSCALE_BIT: 0,
    LEFTMOST_BACKGROUND_VISIBLE_BIT: 1,
    LEFTMOST_SPRITES_VISIBLE_BIT: 2,
    BACKGROUND_VISIBLE_BIT: 3,
    SPRITES_VISIBLE_BIT: 4,
    EMPHASIZE_RED_BIT: 5,
    EMPHASIZE_GREEN_BIT: 6,
    EMPHASIZE_BLUE_BIT: 7,

    //

    /**
     *
     */
    isGreyscale: function() {
        return this.isBitSet(this.GREYSCALE_BIT);
    },

    /**
     *
     */
    isLeftMostBackgroundVisible: function() {
        return this.isBitSet(this.LEFTMOST_BACKGROUND_VISIBLE_BIT);
    },

    /**
     *
     */
    isLeftMostSpritesVisible: function() {
        return this.isBitSet(this.LEFTMOST_SPRITES_VISIBLE_BIT);
    },

    /**
     *
     */
    isBackgroundVisible: function() {
        return this.isBitSet(this.BACKGROUND_VISIBLE_BIT);
    },

    /**
     *
     */
    isSpritesVisible: function() {
        return this.isBitSet(this.SPRITES_VISIBLE_BIT);
    },

    /**
     *
     */
    emphasisRed: function() {
        return this.isBitSet(this.EMPHASIZE_RED_BIT);
    },

    /**
     *
     */
    emphasisGreen: function() {
        return this.isBitSet(this.EMPHASIZE_GREEN_BIT);
    },

    /**
     *
     */
    emphasisBlue: function() {
        return this.isBitSet(this.EMPHASIZE_BLUE_BIT);
    }
});

/**
 *
 */
function PpuStatusRegister() {
    Register8bit.call(this);
}

PpuStatusRegister.prototype = Object.assign(Object.create(Register8bit.prototype), {
    isPpuStatusRegister: true,

    //

    VBLANK_BIT: 7,
    SPRITE_ZERO_HIT_BIT: 6,
    SPRITE_OVERFLOW_BIT: 5,

    //

    /**
     *
     */
    setVBlank: function() {
        this.setBit(this.VBLANK_BIT);
    },

    /**
     *
     */
    clearVBlank: function() {
        this.clearBit(this.VBLANK_BIT);
    },

    /**
     *
     */
    setZeroHit: function() {
        this.setBit(this.SPRITE_ZERO_HIT_BIT);
    },

    /**
     *
     */
    clearZeroHit: function() {
        this.clearBit(this.SPRITE_ZERO_HIT_BIT);
    },

    /**
     *
     */
    setOverflow: function() {
        this.setBit(this.SPRITE_OVERFLOW_BIT);
    },

    /**
     *
     */
    clearOverflow: function() {
        this.clearBit(this.SPRITE_OVERFLOW_BIT);
    }
});

/**
 *
 */
function SpritesManager(memory) {
    this.sprites = [];
    this.init(memory);
}

Object.assign(SpritesManager.prototype, {
    isSpritesManager: true,

    /**
     *
     */
    init: function(memory) {
        for(var i = 0, il = memory.getCapacity() / 4; i < il; i++) {
            this.sprites.push(new Sprite(i, i, memory));
        }
    },

    /**
     *
     */
    getNum: function() {
        return this.sprites.length;
    },

    /**
     *
     */
    get: function(index) {
        return this.sprites[index];
    },

    /**
     *
     */
    copy: function(index, sprite) {
        this.sprites[index].copy(sprite);
    }
});

/**
 *
 */
function Sprite(index, id, memory) {
    this.index = index;
    this.id = id;
    this.memory = memory;
}

Object.assign(Sprite.prototype, {
    isSprite: true,

    //

    /**
     *
     */
    getId: function() {
        return this.id;
    },

    /**
     *
     */
    setId: function(id) {
        this.id = id;
    },

    /**
     *
     */
    getByte0: function() {
        return this.memory.load(this.index * 4 + 0);
    },

    /**
     *
     */
    getByte1: function() {
        return this.memory.load(this.index * 4 + 1);
    },

    /**
     *
     */
    getByte2: function() {
        return this.memory.load(this.index * 4 + 2);
    },

    /**
     *
     */
    getByte3: function() {
        return this.memory.load(this.index * 4 + 3);
    },

    /**
     *
     */
    setByte0: function(value) {
        this.memory.store(this.index * 4 + 0, value);
    },

    /**
     *
     */
    setByte1: function(value) {
        this.memory.store(this.index * 4 + 1, value);
    },

    /**
     *
     */
    setByte2: function(value) {
        this.memory.store(this.index * 4 + 2, value);
    },

    /**
     *
     */
    setByte3: function(value) {
        this.memory.store(this.index * 4 + 3, value);
    },

    /**
     *
     */
    copy: function(sprite) {
        this.setId(sprite.getId());
        this.setByte0(sprite.getByte0());
        this.setByte1(sprite.getByte1());
        this.setByte2(sprite.getByte2());
        this.setByte3(sprite.getByte3());
    },

    /**
     *
     */
    isEmpty: function() {
        return this.getByte0() === 0xFF && this.getByte1() === 0xFF &&
            this.getByte2() === 0xFF && this.getByte3() === 0xFF;
    },

    /**
     *
     */
    isVisible: function() {
        return this.getByte0() < 0xEF;
    },

    /**
     *
     */
    getYPosition: function() {
        return this.getByte0() - 1;
    },

    /**
     *
     */
    getXPosition: function() {
        return this.getByte3();
    },

    /**
     *
     */
    getTileIndex: function() {
        return this.getByte1();
    },

    /**
     *
     */
    getTileIndexForSize16: function() {
        return ((this.getByte1() & 1) * 0x1000) + (this.getByte1() >> 1) * 0x20;
    },

    /**
     *
     */
    getPalletNum: function() {
        return this.getByte2() & 0x3;
    },

    /**
     *
     */
    getPriority: function() {
        return (this.getByte2() >> 5) & 1;
    },

    /**
     *
     */
    doFlipHorizontally: function() {
        return ((this.getByte2() >> 6) & 1) ? true : false;
    },

    /**
     *
     */
    doFlipVertically: function() {
        return ((this.getByte2() >> 7) & 1) ? true : false;
    },

    /**
     *
     */
    on: function(y, length) {
        return (y >= this.getYPosition()) && (y < this.getYPosition() + length);
    }
});


export {Ppu};
