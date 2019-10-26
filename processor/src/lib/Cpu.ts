import chalk from 'chalk';

import {CustomError} from 'ts-custom-error';
import {Bus} from './Bus';
import {CpuState} from './CpuState';
import {disassembleOp, instructionClocksNmos, instructionSizes} from './disassembler';
import {byteToHex, decodeAddress, nanoseconds, numberToByte, wordToHex} from './utils';
import {
    CPU_ADDRESSES,
    DEFAULT_CLOCK_PERIOD_IN_NS,
    DEFAULT_SP,
    P_BREAK,
    P_CARRY,
    P_DECIMAL,
    P_IRQ_DISABLE,
    P_NEGATIVE,
    P_OVERFLOW,
    P_ZERO,
    ROM_SIZE
} from './constants';

export class InstructionBreakException extends CustomError {

    constructor(message: string, public readonly address: number) {
        super(message);
    }
}

export class Cpu {

    private _clockPeriodInNs: number = DEFAULT_CLOCK_PERIOD_IN_NS;

    private _state: CpuState;

    private _bus: Bus;

    private _opBeginTime: number;

    constructor(state = new CpuState(), bus = new Bus()) {
        this.state = state;
        this.bus = bus;
    }

    get clockPeriodInNs(): number {
        return this._clockPeriodInNs;
    }

    set clockPeriodInNs(value: number) {
        this._clockPeriodInNs = value;
    }

    get state(): CpuState {
        return this._state;
    }

    set state(value: CpuState) {
        this._state = value;
    }

    get bus(): Bus {
        return this._bus;
    }

    set bus(value: Bus) {
        this._bus = value;
    }

    public reset(): void {
        this.state.sp = DEFAULT_SP;

        this.state.pc = this.bus.readWord(CPU_ADDRESSES.RST, true);

        this.state.ir = 0;

        this.state.carryFlag = false;
        this.state.zeroFlag = false;
        this.state.irqDisableFlag = true;
        this.state.decimalModeFlag = false;
        this.state.breakFlag = true;
        this.state.overflowFlag = false;
        this.state.negativeFlag = false;

        this.state.irqAsserted = false;

        this.state.noOp = false;

        this.state.stepCounter = 0;

        this.state.a = 0;
        this.state.x = 0;
        this.state.y = 0;

        this.peekAhead();
    }

    public steps(num: number): void {
        for (let i = 0; i < num; i++) {
            this.step();
        }
    }

    public hasStep(): boolean {
        return this.state.pc !== 0;
    }

    public step(): void {
        this._opBeginTime = nanoseconds();

        this.state.lastPc = this.state.pc;

        if (this.state.nmiAsserted) {
            this.handleNmi();
        } else if (this.state.irqAsserted && !this.state.irqDisableFlag) {
            this.handleIrq(this.state.pc);
        }

        const currentPC = this.state.pc;
        this.state.ir = this.bus.readByte(currentPC, true);

        const irAddressMode = (this.state.ir >> 2) & 0x07;
        const irOpMode = this.state.ir & 0x03;

        this.incrementPC();

        this.state.noOp = false;

        this.state.instSize = instructionSizes[this.state.ir];
        for (let i = 0; i < this.state.instSize - 1; i++) {
            this.state.args[i] = this.bus.readByte(this.state.pc, true);
            this.incrementPC();
        }

        this.state.stepCounter++;

        this.runInstruction(currentPC, irAddressMode, irOpMode);

        this.delayLoop(this.state.ir);
        this.peekAhead();
    }

    private calculateEffectiveAddress(irAddressMode: number, irOpMode: number): number {

        switch (irOpMode) {
            case 0:
            case 2:
                switch (irAddressMode) {
                    case 0: // #Immediate
                        return 0;
                    case 1: // Zero Page
                        return this.state.args[0];
                    case 2: // Accumulator - ignored
                        return 0;
                    case 3: // Absolute
                        return decodeAddress(this.state.args[0], this.state.args[1]);
                    case 4: // 65C02 (Zero Page)
                        return 0;
                    case 5: // Zero Page,X / Zero Page,Y
                        if (this.state.ir === 0x14) { // 65C02 TRB Zero Page
                            return this.state.args[0];
                        } else if (this.state.ir === 0x96 || this.state.ir === 0xb6) {
                            return this.zpyAddress(this.state.args[0]);
                        } else {
                            return this.zpxAddress(this.state.args[0]);
                        }
                    case 7:
                        if (this.state.ir === 0x9c || this.state.ir === 0x1c) { // 65C02 STZ & TRB Absolute
                            return decodeAddress(this.state.args[0], this.state.args[1]);
                        }
                        if (this.state.ir === 0xbe) { // Absolute,X / Absolute,Y
                            return this.yAddress(this.state.args[0], this.state.args[1]);
                        }
                        return this.xAddress(this.state.args[0], this.state.args[1]);
                    default:
                        return 0;
                }
            case 1:
                switch (irAddressMode) {
                    case 0: {   // (Zero Page,X)
                        const tmp = (this.state.args[0] + this.state.x) & 0xff;
                        return decodeAddress(this.bus.readByte(tmp, true), this.bus.readByte(tmp + 1, true));
                    }
                    case 1: // Zero Page
                        return this.state.args[0];
                    case 2: // #Immediate
                        return -1;
                    case 3: // Absolute
                        return decodeAddress(this.state.args[0], this.state.args[1]);
                    case 4: {   // (Zero Page),Y
                        const tmp = decodeAddress(this.bus.readByte(this.state.args[0], true),
                            this.bus.readByte((this.state.args[0] + 1) & 0xff, true));
                        return (tmp + this.state.y) & 0xffff;
                    }
                    case 5: // Zero Page,X
                        return this.zpxAddress(this.state.args[0]);
                    case 6: // Absolute, Y
                        return this.yAddress(this.state.args[0], this.state.args[1]);
                    case 7: // Absolute, X
                        return this.xAddress(this.state.args[0], this.state.args[1]);
                    default:
                        return 0;
                }
            case 3:
                switch (irAddressMode) {
                    case 1: // Zero Page
                    case 3:
                    case 5:
                    case 7: // Zero Page, Relative
                        return this.state.args[0];
                    default:
                        return 0;
                }
            default:
                return 0;
        }
    }

    private runInstruction(currentPC: number, irAddressMode: number, irOpMode: number): void {

        const effectiveAddress = this.calculateEffectiveAddress(irAddressMode, irOpMode);
        let implemented = true;
        const memAddress: number[] = new Array();
        const memData: number[] = new Array();

        switch (this.state.ir) {
            case 0x00: // BRK - Force Interrupt - Implied
                throw new InstructionBreakException('Program halt', currentPC);

            // ADC
            case 0x69:  // Imediato
                if (this.state.decimalModeFlag) {
                    this.state.a = this.adcDecimal(this.state.a, this.state.args[0]);
                } else {
                    this.state.a = this.adc(this.state.a, this.state.args[0]);
                }
                break;
            case 0x61: // (Zero Page,X)
            case 0x65: // Zero Page
            case 0x6d: // Absolute
            case 0x71: // (Zero Page),Y
            case 0x75: // Zero Page,X
            case 0x79: // Absolute,Y
            case 0x7d: // Absolute,X
                if (this.state.decimalModeFlag) {
                    this.state.a = this.adcDecimal(this.state.a, this.bus.readWord(effectiveAddress, true));
                } else {
                    this.state.a = this.adc(this.state.a, this.bus.readWord(effectiveAddress, true));
                }
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                break;
            // DEC - TESTAR
            case 0xc6:      // Zero Page
            case 0xce:      // Absolute
            case 0xd6:      // Zero Page,X
            case 0xde: {    // Absolute,X
                const tmp = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(tmp & 0xff);
                this.bus.write(effectiveAddress, (tmp - 1) & 0xff);
                memAddress.push(effectiveAddress);
                memData.push((tmp - 1) & 0xff);
                this.setArithmeticFlags((tmp - 1) & 0xff);
                break;
            }
            // DEX
            case 0xca:
                this.state.x = --this.state.x & 0xff;
                this.setArithmeticFlags(this.state.x);
                break;
            // DEY
            case 0x88:
                this.state.y = --this.state.y & 0xff;
                this.setArithmeticFlags(this.state.y);
                break;
            // INC - TESTAR
            case 0xe6:      // Zero Page
            case 0xee:      // Absolute
            case 0xf6:      // Zero Page,X
            case 0xfe: {    // Absolute,X
                const tmp = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(tmp & 0xff);
                this.bus.write(effectiveAddress, (tmp + 1) & 0xff);
                memAddress.push(effectiveAddress);
                memData.push((tmp + 1) & 0xff);
                this.setArithmeticFlags((tmp + 1) & 0xff);
                break;
            }
            // INX
            case 0xe8:
                this.state.x = ++this.state.x & 0xff;
                this.setArithmeticFlags(this.state.x);
                break;
            // INY
            case 0xc8:
                this.state.y = ++this.state.y & 0xff;
                this.setArithmeticFlags(this.state.y);
                break;
            // LDA
            case 0xa9: // Imediato
                this.state.a = this.state.args[0];
                this.setArithmeticFlags(this.state.a);
                break;
            case 0xa1: // (Zero Page,X)
            case 0xa5: // Zero Page
            case 0xad: // Absolute
            case 0xb1: // (Zero Page),Y
            case 0xb5: // Zero Page,X
            case 0xb9: // Absolute,Y
            case 0xbd: // Absolute,X
                this.state.a = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            // LDX
            case 0xa2: // Imediato
                this.state.x = this.state.args[0];
                this.setArithmeticFlags(this.state.x);
                break;
            case 0xa6: // Zero Page
            case 0xae: // Absolute
            case 0xb6: // Zero Page,Y
            case 0xbe: // Absolute,Y
                this.state.x = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.state.x);
                this.setArithmeticFlags(this.state.x);
                break;
            // LDY
            case 0xa0: // Imediato
                this.state.y = this.state.args[0];
                this.setArithmeticFlags(this.state.y);
                break;
            case 0xa4: // Zero Page
            case 0xac: // Absolute
            case 0xb4: // Zero Page,X
            case 0xbc: // Absolute,X
                this.state.y = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.state.y);
                this.setArithmeticFlags(this.state.y);
                break;
            // PHA
            case 0x48: // PHA
                this.stackPush(this.state.a);
                memAddress.push(CPU_ADDRESSES.STACK + this.state.sp + 1);
                memData.push(this.state.a);
                break;
            // PHP
            case 0x08: // PHP
                this.stackPush(this.state.getStatusFlag());
                memAddress.push(CPU_ADDRESSES.STACK + this.state.sp + 1);
                memData.push(this.state.getStatusFlag());
                break;
            // PLA
            case 0x68:
                this.state.a = this.stackPop();
                memAddress.push(CPU_ADDRESSES.STACK + this.state.sp);
                memData.push(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            // PLP
            case 0x28:
                this.setProcessorStatus(this.stackPop());
                memAddress.push(CPU_ADDRESSES.STACK + this.state.sp);
                memData.push(this.state.getStatusFlag());
                break;
            // SBC
            case 0xe9: // Imediato
                if (this.state.decimalModeFlag) {
                    this.state.a = this.sbcDecimal(this.state.a, this.state.args[0]);
                } else {
                    this.state.a = this.sbc(this.state.a, this.state.args[0]);
                }
                break;
            case 0xe1: // (Zero Page,X)
            case 0xe5: // Zero Page
            case 0xed: // Absolute
            case 0xf1: // (Zero Page),Y
            case 0xf5: // Zero Page,X
            case 0xf9: // Absolute,Y
            case 0xfd: // Absolute,X
                if (this.state.decimalModeFlag) {
                    this.state.a = this.sbcDecimal(this.state.a, this.bus.readWord(effectiveAddress, true));
                } else {
                    this.state.a = this.sbc(this.state.a, this.bus.readWord(effectiveAddress, true));
                }
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                break;
            // STA
            case 0x81: // (Zero Page,X)
            case 0x85: // Zero Page
            case 0x8d: // Absolute
            case 0x91: // (Zero Page),Y
            case 0x95: // Zero Page,X
            case 0x99: // Absolute,Y
            case 0x9d: // Absolute,X
                memAddress.push(effectiveAddress);
                memData.push(this.state.a);
                this.bus.write(effectiveAddress, this.state.a);
                break;
            // STX
            case 0x86: // Zero Page
            case 0x8e: // Absolute
            case 0x96: // Zero Page,Y
                memAddress.push(effectiveAddress);
                memData.push(this.state.x);
                this.bus.write(effectiveAddress, this.state.x);
                break;
            // STY
            case 0x84: // Zero Page
            case 0x8c: // Absolute
            case 0x94: // Zero Page,X
                memAddress.push(effectiveAddress);
                memData.push(this.state.y);
                this.bus.write(effectiveAddress, this.state.y);
                break;
            // TAX
            case 0xaa:
                this.state.x = this.state.a;
                this.setArithmeticFlags(this.state.x);
                break;
            // TAY
            case 0xa8:
                this.state.y = this.state.a;
                this.setArithmeticFlags(this.state.y);
                break;
            // TSX
            case 0xba:
                this.state.x = this.state.sp;
                this.setArithmeticFlags(this.state.x);
                break;
            //  TXA
            case 0x8a:
                this.state.a = this.state.x;
                this.setArithmeticFlags(this.state.a);
                break;
            // TXS
            case 0x9a:
                this.state.sp = this.state.x;
                break;
            // TYA
            case 0x98:
                this.state.a = this.state.y;
                this.setArithmeticFlags(this.state.a);
                break;

            /** ASL - Arithmetic Shift Left *****************************************/
            case 0x0a: // Accumulator
                this.state.a = this.asl(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x06:      // Zero Page
            case 0x0e:      // Absolute
            case 0x16:      // Zero Page,X
            case 0x1e: {    // Absolute,X
                const tmp = this.asl(this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.bus.write(effectiveAddress, tmp);
                memAddress.push(effectiveAddress);
                memData.push(tmp);
                this.setArithmeticFlags(tmp);
                break;
            }

            /** BIT - Bit Test ******************************************************/
            // Nao foi testado ainda.
            case 0x89: // 65C02 #Immediate
                this.setZeroFlag((this.state.a & this.state.args[0]) === 0);
                break;
            case 0x24:      // Zero Page
            case 0x2c:      // Absolute
            case 0x3c: {    // Absolute,X
                const tmp = this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(tmp);
                this.setZeroFlag((this.state.a & tmp) === 0);
                this.setNegativeFlag((tmp & 0x80) !== 0);
                this.setOverflowFlag((tmp & 0x40) !== 0);
                break;
            }

            /** ORA - Logical Inclusive Or ******************************************/
            case 0x09: // #Immediate
                this.state.a |= this.state.args[0];
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x01: // (Zero Page,X)
            case 0x05: // Zero Page
            case 0x0d: // Absolute
            case 0x11: // (Zero Page),Y
            case 0x15: // Zero Page,X
            case 0x19: // Absolute,Y
            case 0x1d: // Absolute,X
                this.state.a |= this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.setArithmeticFlags(this.state.a);
                break;
            case 0xf0: // BEQ - Branch if Equal to Zero - Relative
                if (this.getZeroFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0xd0: // BNE - Branch if Not Equal to Zero - Relative
                if (!this.getZeroFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x90: // BCC - Branch if Carry Clear - Relative
                if (!this.getCarryFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0xb0: // BCS - Branch if Carry Set - Relative
                if (this.getCarryFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x30: // BMI - Branch if Minus - Relative
                if (this.getNegativeFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x10: // BPL - Branch if Positive - Relative
                if (!this.getNegativeFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x50: // BVC - Branch if Overflow Clear - Relative
                if (!this.getOverflowFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x70: // BVS - Branch if Overflow Set - Relative
                if (this.getOverflowFlag()) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;

            case 0x18: // CLC - Clear Carry Flag - Implied
                this.state.carryFlag = false;
                break;

            case 0xd8: // CLD - Clear Decimal Mode - Implied
                this.state.decimalModeFlag = false;
                break;

            case 0x58: // CLI - Clear Interrupt Disable - Implied
                this.state.irqDisableFlag = false;
                break;

            case 0xb8: // CLV - Clear Overflow Flag - Implied
                this.state.overflowFlag = false;
                break;

            /** CPX - Compare X Register ********************************************/
            case 0xe0: // #Immediate
                this.cmp(this.state.x, this.state.args[0]);
                break;
            case 0xe4: // Zero Page
            case 0xec: // Absolute
                this.cmp(this.state.x, this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                break;

            /** CPY - Compare Y Register ********************************************/
            case 0xc0: // #Immediate
                this.cmp(this.state.y, this.state.args[0]);
                break;
            case 0xc4: // Zero Page
            case 0xcc: // Absolute
                this.cmp(this.state.y, this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                break;
            /** CMP - Compare Accumulator *******************************************/
            case 0xc9: // #Immediate
                this.cmp(this.state.a, this.state.args[0]);
                break;
            case 0xc1: // (Zero Page,X)
            case 0xc5: // Zero Page
            case 0xcd: // Absolute
            case 0xd1: // (Zero Page),Y
            case 0xd5: // Zero Page,X
            case 0xd9: // Absolute,Y
            case 0xdd: // Absolute,X
                this.cmp(this.state.a, this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                break;

            /** EOR - Exclusive OR **************************************************/
            case 0x49: // #Immediate
                this.state.a ^= this.state.args[0];
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x41: // (Zero Page,X)
            case 0x45: // Zero Page
            case 0x4d: // Absolute
            case 0x51: // (Zero Page,Y)
            case 0x55: // Zero Page,X
            case 0x59: // Absolute,Y
            case 0x5d: // Absolute,X
                this.state.a ^= this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x38: // SEC - Set Carry Flag - Implied
                this.state.carryFlag = true;
                break;
            case 0xf8: // SED - Set Decimal Flag - Implied
                this.state.decimalModeFlag = true;
                break;
            case 0x78: // SEI - Set Interrupt Disable - Implied
                this.state.irqDisableFlag = true;
                break;
            /** LSR - Logical Shift Right *******************************************/
            case 0x4a: // Accumulator
                this.state.a = this.lsr(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x46:      // Zero Page
            case 0x4e:      // Absolute
            case 0x56:      // Zero Page,X
            case 0x5e: {    // Absolute,X
                const tmp = this.lsr(this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.bus.write(effectiveAddress, tmp);
                memAddress.push(effectiveAddress);
                memData.push(tmp);
                this.setArithmeticFlags(tmp);
                break;
            }

            /** ROL - Rotate Left ***************************************************/
            case 0x2a: // Accumulator
                this.state.a = this.rol(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x26:      // Zero Page
            case 0x2e:      // Absolute
            case 0x36:      // Zero Page,X
            case 0x3e: {    // Absolute,X
                const tmp = this.rol(this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.bus.write(effectiveAddress, tmp);
                memAddress.push(effectiveAddress);
                memData.push(tmp);
                this.setArithmeticFlags(tmp);
                break;
            }

            /** ROR - Rotate Right **************************************************/
            case 0x6a: // Accumulator
                this.state.a = this.ror(this.state.a);
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x66:      // Zero Page
            case 0x6e:      // Absolute
            case 0x76:      // Zero Page,X
            case 0x7e: {    // Absolute,X
                const tmp = this.ror(this.bus.readWord(effectiveAddress, true));
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.bus.write(effectiveAddress, tmp);
                memAddress.push(effectiveAddress);
                memData.push(tmp);
                this.setArithmeticFlags(tmp);
                break;
            }

            /** AND - Logical AND ***************************************************/
            case 0x29: // #Immediate
                this.state.a &= this.state.args[0];
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x21: // (Zero Page,X)
            case 0x25: // Zero Page
            case 0x2d: // Absolute
            case 0x31: // (Zero Page),Y
            case 0x35: // Zero Page,X
            case 0x39: // Absolute,Y
            case 0x3d: // Absolute,X
                this.state.a &= this.bus.readWord(effectiveAddress, true);
                memAddress.push(effectiveAddress);
                memData.push(this.bus.readWord(effectiveAddress, true));
                this.setArithmeticFlags(this.state.a);
                break;
            case 0x40: {    // RTI - Return from Interrupt - Implied
                this.setProcessorStatus(this.stackPop());
                const lo = this.stackPop();
                const hi = this.stackPop();
                this.setProgramCounter(decodeAddress(lo, hi));
                break;
            }
            case 0x60: {    // RTS - Return from Subroutine - Implied
                const lo = this.stackPop();
                const hi = this.stackPop();
                this.setProgramCounter((decodeAddress(lo, hi) + 1) & 0xffff);
                break;
            }
            case 0x20: // JSR - Jump to Subroutine - Implied
                this.stackPush((this.state.pc - 1 >> 8) & 0xff); // PC high byte
                this.stackPush(this.state.pc - 1 & 0xff);        // PC low byte
                this.state.pc = decodeAddress(this.state.args[0], this.state.args[1]);
                break;
            /** JMP *****************************************************************/
            case 0x4c: {    // JMP - Absolute
                const teste = decodeAddress(this.state.args[0], this.state.args[1]);
                this.state.pc = teste;
                break;
            }
            case 0x6c: {    // JMP - Indirect
                const lo = decodeAddress(this.state.args[0], this.state.args[1]); // Address of low byte
                const hi = this.state.args[0] === 0xff ? decodeAddress(0x00, this.state.args[1]) : lo + 1;
                this.state.pc = decodeAddress(this.bus.readByte(lo, true), this.bus.readByte(hi, true));
                break;
            }
            default:
                implemented = false;
                this.state.noOp = true;

        }

        // TODO: show only if running in CLI mode
        return;
        if (this.state.ir !== 0x00) {
            const text = process.env.NODE_ENV === 'DEBUG'
                ? this.state.toTraceEventDebug(currentPC)
                : this.state.toTraceEvent(currentPC);

            const formattedText = process.env.NODE_ENV === 'DEBUG'
                ? implemented ? chalk.green(text) : chalk.red(text)
                : implemented ? text : null;

            if (memAddress.length > 0) {
                if (formattedText !== null) {
                    process.stdout.write(formattedText);
                    for (let i = 0; i < memAddress.length; i++) {
                        process.stdout.write(' mem[' + wordToHex(memAddress[i]) + '] = ' + byteToHex(memData[i]) + ' |');
                    }
                    process.stdout.write('\n');
                }
            } else {
                if (formattedText !== null) {
                    console.log(formattedText);
                }
            }
        }
    }

    private peekAhead(): void {

        this.state.nextIr = this.bus.readByte(this.state.pc, true);

        const nextInstSize = instructionSizes[this.state.nextIr];

        for (let i = 1; i < nextInstSize; i++) {
            const nextRead = (this.state.pc + i) % this.bus.endAddress;
            this.state.nextArgs[i - 1] = this.bus.readByte(nextRead, true);
        }
    }

    public handleBrk(returnPc: number): void {
        this.handleInterrupt(returnPc, CPU_ADDRESSES.IRQ, true);
        this.state.irqAsserted = false;
    }

    public handleIrq(returnPc: number): void {
        this.handleInterrupt(returnPc, CPU_ADDRESSES.IRQ, false);
        this.state.irqAsserted = false;
    }

    public handleNmi(): void {
        this.handleInterrupt(this.state.pc, CPU_ADDRESSES.NMI, false);
        this.state.nmiAsserted = false;
    }

    private handleInterrupt(returnPc: number, address16: number, isBreak: boolean): void {

        this.state.breakFlag = isBreak;

        this.stackPush((returnPc >> 8) & 0xff);
        this.stackPush(returnPc & 0xff);
        this.stackPush(this.state.getStatusFlag());

        this.state.irqDisableFlag = true;

        this.state.pc = this.bus.readWord(address16, true);
    }

    public stackPush(data: number): void {
        this.bus.write(CPU_ADDRESSES.STACK + this.state.sp, data);
        if (this.state.sp === 0) {
            this.state.sp = 0xff;
        } else {
            this.state.sp--;
        }
    }

    public stackPop() {

        if (this.state.sp === 0xff) {
            this.state.sp = 0x00;
        } else {
            this.state.sp++;
        }

        return this.bus.readByte(CPU_ADDRESSES.STACK + this.state.sp, true);
    }

    public stackPeek() {
        return this.bus.readByte(CPU_ADDRESSES.STACK + this.state.sp + 1, true);
    }

    public setProgramCounter(addr: number): void {
        this.state.pc = addr;

        try {
            this.peekAhead();
        } catch (err) {
            console.error('Could not peek ahead at next instruction state.', err);
        }
    }

    public setProcessorStatus(value: number): void {
        this.state.carryFlag = (value & P_CARRY) !== 0;
        this.state.zeroFlag = (value & P_ZERO) !== 0;
        this.state.irqDisableFlag = (value & P_IRQ_DISABLE) !== 0;
        this.state.decimalModeFlag = (value & P_DECIMAL) !== 0;
        this.state.breakFlag = (value & P_BREAK) !== 0;
        this.state.overflowFlag = (value & P_OVERFLOW) !== 0;
        this.state.negativeFlag = (value & P_NEGATIVE) !== 0;
    }


    private incrementPC(): void {
        this.state.pc = (this.state.pc + 1) % (ROM_SIZE + 1);
    }

    private xAddress(lowByte: number, hiByte: number): number {
        return (decodeAddress(lowByte, hiByte) + this.state.x) & 0xffff;
    }

    private yAddress(lowByte: number, hiByte: number) {
        return (decodeAddress(lowByte, hiByte) + this.state.y) & 0xffff;
    }

    private zpxAddress(zp: number) {
        return (zp + this.state.x) & 0xff;
    }

    private zpyAddress(zp: number) {
        return (zp + this.state.y) & 0xff;
    }

    private relAddress(offset: number) {
        return (this.state.pc + numberToByte(offset)) & 0xffff;
    }

    private delayLoop(opcode: number): void {

        const clockSteps = instructionClocksNmos[0xff & opcode];

        if (clockSteps === 0) {
            console.warn('Opcode 0x%02x has clock step of 0!', opcode);
            return;
        }

        const interval = clockSteps * this._clockPeriodInNs;
        let end;

        do {
            end = nanoseconds();
        } while (this._opBeginTime + interval >= end);
    }

    public disassembleNextOp(): string {
        return disassembleOp(this.state.nextIr, this.state.nextArgs);
    }

    public disassembleOpAtAddress(addr: number): string {

        const opCode = this.bus.readByte(addr, true);
        const args = [0, 0];

        const size = instructionSizes[opCode];
        for (let i = 1; i < size; i++) {
            const nextRead = (addr + i) % this.bus.endAddress;
            args[i - 1] = this.bus.readByte(nextRead, true);
        }

        return disassembleOp(opCode, args);
    }

    public getZeroFlag() {
        return this.state.zeroFlag;
    }

    public getCarryFlag() {
        return this.state.carryFlag;
    }

    public getNegativeFlag() {
        return this.state.negativeFlag;
    }

    public getOverflowFlag() {
        return this.state.overflowFlag;
    }

    public setCarryFlag(carryFlag: boolean) {
        this.state.carryFlag = carryFlag;
    }

    public setZeroFlag(zeroFlag: boolean) {
        this.state.zeroFlag = zeroFlag;
    }

    public setNegativeFlag(negativeFlag: boolean) {
        this.state.negativeFlag = negativeFlag;
    }

    public setOverflowFlag(overflowFlag: boolean) {
        this.state.overflowFlag = overflowFlag;
    }


    private lsr(m: number) {
        this.setCarryFlag((m & 0x01) !== 0);
        return (m & 0xff) >>> 1;
    }

    private asl(m: number) {
        this.setCarryFlag((m & 0x80) !== 0);
        return (m << 1) & 0xff;
    }

    private rol(m: number) {
        const result = ((m << 1) | this.getCarryBit()) & 0xff;
        this.setCarryFlag((m & 0x80) !== 0);
        return result;
    }

    private ror(m: number) {
        const result = ((m >>> 1) | (this.getCarryBit() << 7)) & 0xff;
        this.setCarryFlag((m & 0x01) !== 0);
        return result;
    }

    private cmp(reg: number, operand: number) {
        const tmp = (reg - operand) & 0xff;
        this.setCarryFlag(reg >= operand);
        this.setZeroFlag(tmp === 0);
        this.setNegativeFlag((tmp & 0x80) !== 0); // Negative bit set
    }

    private adc(acc: number, operand: number): number {
        let result = (operand & 0xff) + (acc & 0xff) + this.getCarryBit();
        const carry6 = (operand & 0x7f) + (acc & 0x7f) + this.getCarryBit();
        this.state.carryFlag = (result & 0x100) !== 0;
        this.state.overflowFlag = !!((this.state.carryFlag ? 1 : 0) ^ (((carry6 & 0x80) !== 0) ? 1 : 0));
        result &= 0xff;
        this.setArithmeticFlags(result);
        return result;
    }


    private adcDecimal(acc: number, operand: number): number {
        let l;
        let h;
        let result;
        l = (acc & 0x0f) + (operand & 0x0f) + this.getCarryBit();
        if ((l & 0xff) > 9) { l += 6; }
        h = (acc >> 4) + (operand >> 4) + (l > 15 ? 1 : 0);
        if ((h & 0xff) > 9) { h += 6; }
        result = (l & 0x0f) | (h << 4);
        result &= 0xff;
        this.state.carryFlag = h > 15;
        this.state.zeroFlag = result === 0;
        this.state.overflowFlag = false;
        this.state.negativeFlag = false;

        return result;
    }

    private sbc(acc: number, operand: number): number {
        const result = this.adc(acc, ~operand);
        this.setArithmeticFlags(result);
        return result;
    }

    private sbcDecimal(acc: number, operand: number): number {

        let l = (acc & 0x0f) - (operand & 0x0f) - (this.state.carryFlag ? 0 : 1);
        if ((l & 0x10) !== 0) {
            l -= 6;
        }

        let h = (acc >> 4) - (operand >> 4) - ((l & 0x10) !== 0 ? 1 : 0);
        if ((h & 0x10) !== 0) {
            h -= 6;
        }

        const result = (l & 0x0f) | (h << 4) & 0xff;
        this.state.carryFlag = (h & 0xff) < 15;
        this.state.zeroFlag = result === 0;
        this.state.overflowFlag = false;
        this.state.negativeFlag = false;

        return (result & 0xff);
    }

    private getCarryBit(): number {
        return (this.state.carryFlag ? 1 : 0);
    }

    private setArithmeticFlags(result: number): void {
        this.state.zeroFlag = (result === 0);
        this.state.negativeFlag = (result & 0x80) !== 0;
    }
}
