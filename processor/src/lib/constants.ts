export const P_CARRY       = 0x01;
export const P_ZERO        = 0x02;
export const P_IRQ_DISABLE = 0x04;
export const P_DECIMAL     = 0x08;
export const P_BREAK       = 0x10;

export const P_OVERFLOW    = 0x40;
export const P_NEGATIVE    = 0x80;

export const DEFAULT_CLOCK_PERIOD_IN_NS: number = 1000;

export const ROM_SIZE: number = 0xffff;

export const PPU_CYCLES: number = 341 * 241 * 60;

export const SCREEN_WIDTH: number = 256;
export const SCREEN_HEIGHT: number = 240;

export const DEFAULT_START_ADDRESS: number = 0x0000;
export const DEFAULT_END_ADDRESS: number = ROM_SIZE;
export const DEFAULT_SP: number = 0xfd;

export const OAM_RAM_SIZE = 256;
export const OAM_RAM_SIZE_2 = 32;

// https://en.wikibooks.org/wiki/NES_Programming

// tslint:disable:object-literal-sort-keys
export const CPU_ADDRESSES = {
    RAM: 0x0000,
    ZERO_PAGE: 0x0000,
    STACK: 0x0100,
    ACTUAL_RAM: 0x0200,
    PPU_REG: 0x2000,
    APU_REG: 0x4000,
    SRAM: 0x6000,
    PRG_ROM: 0x8000,
    NMI: 0xfffa,
    RST: 0xfffc,
    IRQ: 0xfffe
};

// TODO: add all mirrors
export const CPU_MEMORY_MIRRORS = {
    RAM: 3,
    PPU_REG: 1023
};

export const CPU_MEMORY_SIZE = {
    RAM: 0x0800,
    PPU_REG: 0x0008,
    PRG_ROM: 0x4000
};

export const COLOR_PALETTES = [
    0xff757575,	// 0x00
    0xff8f1b27,	// 0x01
    0xffab0000,	// 0x02
    0xff9f0047,	// 0x03
    0xff77008f,	// 0x04
    0xff1300ab,	// 0x05
    0xff0000a7,	// 0x06
    0xff000b7f,	// 0x07
    0xff002f43,	// 0x08
    0xff004700,	// 0x09
    0xff005100,	// 0x0a
    0xff173f00,	// 0x0b
    0xff5f3f1b,	// 0x0c
    0xff000000,	// 0x0d
    0xff000000,	// 0x0e
    0xff000000,	// 0x0f
    0xffbcbcbc,	// 0x10
    0xffef7300,	// 0x11
    0xffef3b23,	// 0x12
    0xfff30083,	// 0x13
    0xffbf00bf,	// 0x14
    0xff5b00e7,	// 0x15
    0xff002bdb,	// 0x16
    0xff0f4fcb,	// 0x17
    0xff00738b,	// 0x18
    0xff009700,	// 0x19
    0xff00ab00,	// 0x1a
    0xff3b9300,	// 0x1b
    0xff8b8300,	// 0x1c
    0xff000000,	// 0x1d
    0xff000000,	// 0x1e
    0xff000000,	// 0x1f
    0xffffffff,	// 0x20
    0xffffbf3f,	// 0x21
    0xffff975f,	// 0x22
    0xfffd8ba7,	// 0x23
    0xffff7bf7,	// 0x24
    0xffb777ff,	// 0x25
    0xff6377ff,	// 0x26
    0xff3b9bff,	// 0x27
    0xff3fbff3,	// 0x28
    0xff13d383,	// 0x29
    0xff4bdf4f,	// 0x2a
    0xff98f858,	// 0x2b
    0xffdbeb00,	// 0x2c
    0xff000000,	// 0x2d
    0xff000000,	// 0x2e
    0xff000000,	// 0x2f
    0xffffffff,	// 0x30
    0xffffe7ab,	// 0x31
    0xffffd7c7,	// 0x32
    0xffffcbd7,	// 0x33
    0xffffc7ff,	// 0x34
    0xffdbc7ff,	// 0x35
    0xffb3bfff,	// 0x36
    0xffabdbff,	// 0x37
    0xffa3e7ff,	// 0x38
    0xffa3ffe3,	// 0x39
    0xffbff3ab,	// 0x3a
    0xffcfffb3,	// 0x3b
    0xfff3ff9f,	// 0x3c
    0xff000000,	// 0x3d
    0xff000000,	// 0x3e
    0xff000000,	// 0x3f
];
