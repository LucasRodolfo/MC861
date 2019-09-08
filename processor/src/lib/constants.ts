export const P_CARRY       = 0x01;
export const P_ZERO        = 0x02;
export const P_IRQ_DISABLE = 0x04;
export const P_DECIMAL     = 0x08;
export const P_BREAK       = 0x10;

export const P_OVERFLOW    = 0x40;
export const P_NEGATIVE    = 0x80;

export const NMI_VECTOR_L = 0xfffa;
export const NMI_VECTOR_H = 0xfffb;

export const RST_VECTOR_L = 0xfffc;
export const RST_VECTOR_H = 0xfffd;

export const IRQ_VECTOR_L = 0xfffe;
export const IRQ_VECTOR_H = 0xffff;

export const DEFAULT_CLOCK_PERIOD_IN_NS: number = 1000;

export const ROM_SIZE: number = 0xffff;

export const DEFAULT_START_ADDRESS: number  = 0x0000;
export const DEFAULT_END_ADDRESS: number    = ROM_SIZE;
export const DEFAULT_LOAD_ADDRESS: number   = 0x0200;
