export const P_CARRY       = 0x01;
export const P_ZERO        = 0x02;
export const P_IRQ_DISABLE = 0x04;
export const P_DECIMAL     = 0x08;
export const P_BREAK       = 0x10;

export const P_OVERFLOW    = 0x40;
export const P_NEGATIVE    = 0x80;

export const DEFAULT_CLOCK_PERIOD_IN_NS: number = 1000;

export const ROM_SIZE: number = 0xffff;

export const DEFAULT_START_ADDRESS: number  = 0x0000;
export const DEFAULT_END_ADDRESS: number    = ROM_SIZE;

// https://en.wikibooks.org/wiki/NES_Programming

// tslint:disable:object-literal-sort-keys
export const ADDRESS = {
    ZERO_PAGE: 0x0000,
    STACK: 0x0100,
    RAM: 0x0200,
    IO8: 0x2000,
    IO32: 0x4000,
    SRAM: 0x6000,
    PRG_ROM: 0x8000,
    NMI: 0xfffa,
    RST: 0xfffc,
    IRQ: 0xfffe
};

export const SIZE = {
    ZERO_PAGE: ADDRESS.STACK - ADDRESS.ZERO_PAGE,
    PRG_ROM: 0x4000
};
