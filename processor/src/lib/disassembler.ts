import {decodeAddress, byteToHex, wordToHex} from './utils';

export enum Mode {
    ACC = 'Accumulator',
    AIX = 'Absolute, X-Indexed Indirect',
    ABS = 'Absolute',
    ABX = 'Absolute, X-indexed',
    ABY = 'Absolute, Y-indexed',
    IMM = 'Immediate',
    IMP = 'Implied',
    IND = 'Indirect',
    XIN = 'X-indexed Indirect',
    INY = 'Indirect, Y-indexed',
    REL = 'Relative',
    ZPG = 'Zero Page',
    ZPR = 'Zero Page, Relative',
    ZPX = 'Zero Page, X-indexed',
    ZPY = 'Zero Page, Y-indexed',
    ZPI = 'Zero Page Indirect',
    NUL = 'NULL'
}

export const opcodeNames: string[] = [
    'BRK', 'ORA', 'NOP', 'NOP', 'TSB', 'ORA', 'ASL',  'RMB0',  // 0x00-0x07
    'PHP', 'ORA', 'ASL', 'NOP', 'TSB', 'ORA', 'ASL',  'BBR0',  // 0x08-0x0f
    'BPL', 'ORA', 'ORA', 'NOP', 'TRB', 'ORA', 'ASL',  'RMB1',  // 0x10-0x17
    'CLC', 'ORA', 'INC', 'NOP', 'TRB', 'ORA', 'ASL',  'BBR1',  // 0x18-0x1f
    'JSR', 'AND', 'NOP', 'NOP', 'BIT', 'AND', 'ROL',  'RMB2',  // 0x20-0x27
    'PLP', 'AND', 'ROL', 'NOP', 'BIT', 'AND', 'ROL',  'BBR2',  // 0x28-0x2f
    'BMI', 'AND', 'AND', 'NOP', 'BIT', 'AND', 'ROL',  'RMB3',  // 0x30-0x37
    'SEC', 'AND', 'DEC', 'NOP', 'BIT', 'AND', 'ROL',  'BBR3',  // 0x38-0x3f
    'RTI', 'EOR', 'NOP', 'NOP', 'NOP', 'EOR', 'LSR',  'RMB4',  // 0x40-0x47
    'PHA', 'EOR', 'LSR', 'NOP', 'JMP', 'EOR', 'LSR',  'BBR4',  // 0x48-0x4f
    'BVC', 'EOR', 'EOR', 'NOP', 'NOP', 'EOR', 'LSR',  'RMB5',  // 0x50-0x57
    'CLI', 'EOR', 'PHY', 'NOP', 'NOP', 'EOR', 'LSR',  'BBR5',  // 0x58-0x5f
    'RTS', 'ADC', 'NOP', 'NOP', 'STZ', 'ADC', 'ROR',  'RMB6',  // 0x60-0x67
    'PLA', 'ADC', 'ROR', 'NOP', 'JMP', 'ADC', 'ROR',  'BBR6',  // 0x68-0x6f
    'BVS', 'ADC', 'ADC', 'NOP', 'STZ', 'ADC', 'ROR',  'RMB7',  // 0x70-0x77
    'SEI', 'ADC', 'PLY', 'NOP', 'JMP', 'ADC', 'ROR',  'BBR7',  // 0x78-0x7f
    'BRA', 'STA', 'NOP', 'NOP', 'STY', 'STA', 'STX',  'SMB0',  // 0x80-0x87
    'DEY', 'BIT', 'TXA', 'NOP', 'STY', 'STA', 'STX',  'BBS0',  // 0x88-0x8f
    'BCC', 'STA', 'STA', 'NOP', 'STY', 'STA', 'STX',  'SMB1',  // 0x90-0x97
    'TYA', 'STA', 'TXS', 'NOP', 'STZ', 'STA', 'STZ',  'BBS1',  // 0x98-0x9f
    'LDY', 'LDA', 'LDX', 'NOP', 'LDY', 'LDA', 'LDX',  'SMB2',  // 0xa0-0xa7
    'TAY', 'LDA', 'TAX', 'NOP', 'LDY', 'LDA', 'LDX',  'BBS2',  // 0xa8-0xaf
    'BCS', 'LDA', 'LDA', 'NOP', 'LDY', 'LDA', 'LDX',  'SMB3',  // 0xb0-0xb7
    'CLV', 'LDA', 'TSX', 'NOP', 'LDY', 'LDA', 'LDX',  'BBS3',  // 0xb8-0xbf
    'CPY', 'CMP', 'NOP', 'NOP', 'CPY', 'CMP', 'DEC',  'SMB4',  // 0xc0-0xc7
    'INY', 'CMP', 'DEX', 'NOP', 'CPY', 'CMP', 'DEC',  'BBS4',  // 0xc8-0xcf
    'BNE', 'CMP', 'CMP', 'NOP', 'NOP', 'CMP', 'DEC',  'SMB5',  // 0xd0-0xd7
    'CLD', 'CMP', 'PHX', 'NOP', 'NOP', 'CMP', 'DEC',  'BBS5',  // 0xd8-0xdf
    'CPX', 'SBC', 'NOP', 'NOP', 'CPX', 'SBC', 'INC',  'SMB6',  // 0xe0-0xe7
    'INX', 'SBC', 'NOP', 'NOP', 'CPX', 'SBC', 'INC',  'BBS6',  // 0xe8-0xef
    'BEQ', 'SBC', 'SBC', 'NOP', 'NOP', 'SBC', 'INC',  'SMB7',  // 0xf0-0xf7
    'SED', 'SBC', 'PLX', 'NOP', 'NOP', 'SBC', 'INC',  'BBS7'   // 0xf8-0xff
];

export const instructionModes: Mode[] = [
    Mode.IMP, Mode.XIN, Mode.NUL, Mode.NUL,   // 0x00-0x03
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0x04-0x07
    Mode.IMP, Mode.IMM, Mode.ACC, Mode.NUL,   // 0x08-0x0b
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0x0c-0x0f
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0x10-0x13
    Mode.ZPG, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0x14-0x17
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0x18-0x1b
    Mode.ABS, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0x1c-0x1f
    Mode.ABS, Mode.XIN, Mode.NUL, Mode.NUL,   // 0x20-0x23
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0x24-0x27
    Mode.IMP, Mode.IMM, Mode.ACC, Mode.NUL,   // 0x28-0x2b
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0x2c-0x2f
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0x30-0x33
    Mode.ZPX, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0x34-0x37
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0x38-0x3b
    Mode.NUL, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0x3c-0x3f
    Mode.IMP, Mode.XIN, Mode.NUL, Mode.NUL,   // 0x40-0x43
    Mode.NUL, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0x44-0x47
    Mode.IMP, Mode.IMM, Mode.ACC, Mode.NUL,   // 0x48-0x4b
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0x4c-0x4f
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0x50-0x53
    Mode.NUL, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0x54-0x57
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0x58-0x5b
    Mode.NUL, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0x5c-0x5f
    Mode.IMP, Mode.XIN, Mode.NUL, Mode.NUL,   // 0x60-0x63
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0x64-0x67
    Mode.IMP, Mode.IMM, Mode.ACC, Mode.NUL,   // 0x68-0x6b
    Mode.IND, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0x6c-0x6f
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0x70-0x73
    Mode.ZPX, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0x74-0x77
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0x78-0x7b
    Mode.AIX, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0x7c-0x7f
    Mode.REL, Mode.XIN, Mode.NUL, Mode.NUL,   // 0x80-0x83
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0x84-0x87
    Mode.IMP, Mode.IMM, Mode.IMP, Mode.NUL,   // 0x88-0x8b
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0x8c-0x8f
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0x90-0x93
    Mode.ZPX, Mode.ZPX, Mode.ZPY, Mode.ZPG,   // 0x94-0x97
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0x98-0x9b
    Mode.ABS, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0x9c-0x9f
    Mode.IMM, Mode.XIN, Mode.IMM, Mode.NUL,   // 0xa0-0xa3
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0xa4-0xa7
    Mode.IMP, Mode.IMM, Mode.IMP, Mode.NUL,   // 0xa8-0xab
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0xac-0xaf
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0xb0-0xb3
    Mode.ZPX, Mode.ZPX, Mode.ZPY, Mode.ZPG,   // 0xb4-0xb7
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0xb8-0xbb
    Mode.ABX, Mode.ABX, Mode.ABY, Mode.ZPR,   // 0xbc-0xbf
    Mode.IMM, Mode.XIN, Mode.NUL, Mode.NUL,   // 0xc0-0xc3
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0xc4-0xc7
    Mode.IMP, Mode.IMM, Mode.IMP, Mode.NUL,   // 0xc8-0xcb
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0xcc-0xcf
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0xd0-0xd3
    Mode.NUL, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0xd4-0xd7
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0xd8-0xdb
    Mode.NUL, Mode.ABX, Mode.ABX, Mode.ZPR,   // 0xdc-0xdf
    Mode.IMM, Mode.XIN, Mode.NUL, Mode.NUL,   // 0xe0-0xe3
    Mode.ZPG, Mode.ZPG, Mode.ZPG, Mode.ZPG,   // 0xe4-0xe7
    Mode.IMP, Mode.IMM, Mode.IMP, Mode.NUL,   // 0xe8-0xeb
    Mode.ABS, Mode.ABS, Mode.ABS, Mode.ZPR,   // 0xec-0xef
    Mode.REL, Mode.INY, Mode.ZPI, Mode.NUL,   // 0xf0-0xf3
    Mode.NUL, Mode.ZPX, Mode.ZPX, Mode.ZPG,   // 0xf4-0xf7
    Mode.IMP, Mode.ABY, Mode.IMP, Mode.NUL,   // 0xf8-0xfb
    Mode.NUL, Mode.ABX, Mode.ABX, Mode.ZPR    // 0xfc-0xff
];

export const instructionSizes: number[] = [
    1, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0x00-0x0f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0x10-0x1f
    3, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0x20-0x2f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0x30-0x3f
    1, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0x40-0x4f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0x50-0x5f
    1, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0x60-0x6f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0x70-0x7f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0x80-0x8f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0x90-0x9f
    2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0xa0-0xaf
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0xb0-0xbf
    2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0xc0-0xcf
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3,   // 0xd0-0xdf
    2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 1, 3, 3, 3, 3,   // 0xe0-0xef
    2, 2, 2, 1, 2, 2, 2, 2, 1, 3, 1, 1, 3, 3, 3, 3    // 0xf0-0xff
];

export const instructionClocksNmos: number[] = [
    7, 6, 1, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,   // 0x00-0x0f
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,   // 0x10-0x1f
    6, 6, 1, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,   // 0x20-0x2f
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,   // 0x30-0x3f
    6, 6, 1, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,   // 0x40-0x4f
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,   // 0x50-0x5f
    6, 6, 1, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,   // 0x60-0x6f
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,   // 0x70-0x7f
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,   // 0x80-0x8f
    2, 6, 1, 6, 4, 4, 4, 4, 2, 5, 2, 5, 5, 5, 5, 5,   // 0x90-0x9f
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,   // 0xa0-0xaf
    2, 5, 1, 5, 4, 4, 4, 4, 2, 4, 2, 4, 4, 4, 4, 4,   // 0xb0-0xbf
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,   // 0xc0-0xcf
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,   // 0xd0-0xdf
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,   // 0xe0-0xef
    2, 5, 1, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7    // 0xf0-0xff
];

export function disassembleOp(opCode: number, args: number[]): string {

    const mnemonic = opcodeNames[opCode];

    if (!mnemonic) {
        return '???';
    }

    return mnemonic + addressing(opCode, args);
}


function addressing(opCode: number, args: number[]): string {

    switch (instructionModes[opCode]) {
        case Mode.ABS:
            return ` $${wordToHex(decodeAddress(args[0], args[1]))}`;
        case Mode.AIX:
            return ` ($${wordToHex(decodeAddress(args[0], args[1]))},X)`;
        case Mode.ABX:
            return ` $${wordToHex(decodeAddress(args[0], args[1]))},X`;
        case Mode.ABY:
            return ` $${wordToHex(decodeAddress(args[0], args[1]))},Y`;
        case Mode.IMM:
            return ` #$${byteToHex(args[0])}`;
        case Mode.IND:
            return ` ($${wordToHex(decodeAddress(args[0], args[1]))})`;
        case Mode.XIN:
            return ` ($${byteToHex(args[0])},X)`;
        case Mode.INY:
            return ` ($${byteToHex(args[0])}),Y`;
        case Mode.REL:
        case Mode.ZPR:
        case Mode.ZPG:
            return ` $${byteToHex(args[0])}`;
        case Mode.ZPX:
            return ` $${byteToHex(args[0])},X`;
        case Mode.ZPY:
            return ` $${byteToHex(args[0])},Y`;
        default:
            return '';
    }
}
