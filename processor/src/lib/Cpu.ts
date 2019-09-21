import chalk from 'chalk';

import {Bus} from './Bus';
import {CpuState} from './CpuState';
import {disassembleOp, instructionClocksNmos, instructionSizes} from './disassembler';
import {decodeAddress, nanoseconds, numberToByte} from './utils';


import {
    ADDRESS,
    DEFAULT_CLOCK_PERIOD_IN_NS,
    P_BREAK,
    P_CARRY,
    P_DECIMAL,
    P_IRQ_DISABLE,
    P_NEGATIVE,
    P_OVERFLOW,
    P_ZERO,
    ROM_SIZE
} from './constants';

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
        this.state.sp = 0xff;

        this.state.pc = this.bus.readWord(ADDRESS.RST, true);

        this.state.ir = 0;

        this.state.carryFlag = false;
        this.state.zeroFlag = false;
        this.state.irqDisableFlag = false;
        this.state.decimalModeFlag = false;
        this.state.breakFlag = false;
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

        switch (this.state.ir) {

            //Nao testei ainda (Lucas)
            //case 0x00: // BRK - Force Interrupt - Implied
            //  this.handleBrk(this.state.pc + 1);
            //  break;
            case 0xf0: // BEQ - Branch if Equal to Zero - Relative
                if (this.state.zeroFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                this.state.zeroFlag = false;
                break;
            case 0xd0: // BNE - Branch if Not Equal to Zero - Relative
                if (!this.state.zeroFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x90: // BCC - Branch if Carry Clear - Relative
                if (!this.state.carryFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0xb0: // BCS - Branch if Carry Set - Relative
                if (this.state.carryFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x30: // BMI - Branch if Minus - Relative
                if (this.state.negativeFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x10: // BPL - Branch if Positive - Relative
                if (!this.state.negativeFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x50: // BVC - Branch if Overflow Clear - Relative
                if (!this.state.overflowFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x70: // BVS - Branch if Overflow Set - Relative
                if (this.state.overflowFlag) {
                    this.state.pc = this.relAddress(this.state.args[0]);
                }
                break;
            case 0x40: {    // RTI - Return from Interrupt - Implied
                this.setProcessorStatus(this.stackPop());
                const lo = this.stackPop();
                const hi = this.stackPop();
                this.setProgramCounter(decodeAddress(lo, hi));
                break;
            }
            case 0x20: // JSR - Jump to Subroutine - Implied
                this.stackPush((this.state.pc - 1 >> 8) & 0xff); // PC high byte
                this.stackPush(this.state.pc - 1 & 0xff);        // PC low byte
                this.state.pc = decodeAddress(this.state.args[0], this.state.args[1]);
                break;
            //NAO TESTADO AINDA!
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


            // /** JMP *****************************************************************/
            // case 0x4c: // JMP - Absolute
            //     thi.state.pc = decodeAddress(this.state.args[0], this.state.args[1]);
            //     break;
            // case 0x6c: // JMP - Indirect
            //     lo = decodeAddress(this.state.args[0], this.state.args[1]); // Address of low byte
            //
            //     if (this.state.args[0] == 0xff) {
            //         hi = decodeAddress(0x00, this.state.args[1]);
            //     } else {
            //         hi = lo + 1;
            //     }
            //
            //     this.state.pc = decodeAddress(bus.readByte(lo, true), bus.readByte(hi, true));
            //     break;
            // case 0x7c: // 65C02 JMP - (Absolute Indexed Indirect,X)
            //     break;
            //     lo = (((this.state.args[1] << 8) | this.state.args[0]) + this.state.x) & 0xffff;
            //     hi = lo + 1;
            //     this.state.pc = decodeAddress(bus.readByte(lo, true), bus.readByte(hi, true));
            //     break;

            default:
                implemented = false;
                this.state.noOp = true;

        }
        if (this.state.ir !== 0x00) {

            const text = process.env.NODE_ENV === 'DEBUG'
                ? this.state.toTraceEventDebug()
                : this.state.toTraceEvent();

            const formattedText = implemented ? chalk.green(text) : chalk.red(text);
            console.log(formattedText);
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

    private handleBrk(returnPc: number): void {
        this.handleInterrupt(returnPc, ADDRESS.IRQ, true);
        this.state.irqAsserted = false;
    }

    private handleIrq(returnPc: number): void {
        this.handleInterrupt(returnPc, ADDRESS.IRQ, false);
        this.state.irqAsserted = false;
    }

    private handleNmi(): void {
        this.handleInterrupt(this.state.pc, ADDRESS.NMI, false);
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

    public stackPush(data: number) {
        this.bus.write(ADDRESS.STACK + this.state.sp, data);

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

        return this.bus.readByte(ADDRESS.STACK + this.state.sp, true);
    }

    public stackPeek() {
        return this.bus.readByte(ADDRESS.STACK + this.state.sp + 1, true);
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
}
