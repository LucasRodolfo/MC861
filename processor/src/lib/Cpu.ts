import chalk from 'chalk';

import {Bus} from './Bus';
import {CpuState} from './CpuState';
import {disassembleOp, instructionClocksNmos, instructionSizes} from './disassembler';
import {address, nanoseconds, wordToHex, byteToHex,numberToByte} from './utils';

import {
    DEFAULT_CLOCK_PERIOD_IN_NS, IRQ_VECTOR_H, IRQ_VECTOR_L, NMI_VECTOR_H, NMI_VECTOR_L,
    P_BREAK,
    P_CARRY,
    P_DECIMAL,
    P_IRQ_DISABLE,
    P_NEGATIVE,
    P_OVERFLOW,
    P_ZERO,
    RST_VECTOR_H,
    RST_VECTOR_L
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

    // @ts-ignore
    get clockPeriodInNs(): number {
        return this._clockPeriodInNs;
    }

    // @ts-ignore
    set clockPeriodInNs(value: number) {
        this._clockPeriodInNs = value;
    }

    // @ts-ignore
    get state(): CpuState {
        return this._state;
    }

    // @ts-ignore
    set state(value: CpuState) {
        this._state = value;
    }

    // @ts-ignore
    get bus(): Bus {
        return this._bus;
    }

    // @ts-ignore
    set bus(value: Bus) {
        this._bus = value;
    }

    public reset(): void {
        this.state.sp = 0xff;

        this.state.pc = address(this.bus.read(RST_VECTOR_L, true), this.bus.read(RST_VECTOR_H, true));

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
        this.state.ir = this.bus.read(currentPC, true);

        const irAddressMode = (this.state.ir >> 2) & 0x07;
        const irOpMode = this.state.ir & 0x03;

        this.incrementPC();

        this.state.noOp = false;

        this.state.instSize = instructionSizes[this.state.ir];
        for (let i = 0; i < this.state.instSize - 1; i++) {
            this.state.args[i] = this.bus.read(this.state.pc, true);
            this.incrementPC();
        }

        this.state.stepCounter++;

        this.runInstruction(currentPC, irAddressMode, irOpMode);

        // Print system state
        if (this.state.ir !== 0x00) {
            console.log(`| pc = ${this.state.pc} | a = ${this.state.a} | x = ${this.state.x} | y = ${this.state.y} | sp = ${this.state.sp} |`);
        }
        this.delayLoop(this.state.ir);
        this.peekAhead();
    }

    private calculateEffectiveAddress(irOpMode: number, irAddressMode: number): number {
        switch (irOpMode) {
            case 0:
            case 2:
                // TODO
                return 0;
            case 1:
                // TODO
                return 0;
            case 3:
                // TODO
                return 0;
        }
    }

    private runInstruction(currentPC: number, irOpMode: number, irAddressMode: number): void {

        const effectiveAddress = this.calculateEffectiveAddress(irOpMode, irAddressMode);

        let implemented = true;

        switch (this.state.ir) {
            // --------------- GRUPO 1 ------------------------
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
                    this.state.a = this.adcDecimal(this.state.a, this.bus.read(effectiveAddress, true));
                } else {
                    this.state.a = this.adc(this.state.a, this.bus.read(effectiveAddress, true));
                }
                break;
            // DEC - TESTAR
            /*case 0xc6: // Zero Page
            case 0xce: // Absolute
            case 0xd6: // Zero Page,X
            case 0xde: // Absolute,X
                var tmp = (this.bus.read(effectiveAddress, true) - 1) & 0xff;
                this.bus.write(effectiveAddress, tmp);
                this.setArithmeticFlags(tmp);
                break;*/
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
            /*case 0xe6: // Zero Page
            case 0xee: // Absolute
            case 0xf6: // Zero Page,X
            case 0xfe: // Absolute,X
                var tmp = (this.bus.read(effectiveAddress, true) + 1) & 0xff;
                this.bus.write(effectiveAddress, tmp);
                this.setArithmeticFlags(tmp);
                break;*/
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
                this.state.a = this.bus.read(effectiveAddress, true);
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
                this.state.x = this.bus.read(effectiveAddress, true);
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
                this.state.y = this.bus.read(effectiveAddress, true);
                this.setArithmeticFlags(this.state.y);
                break;
            // PHA
            case 0x48: // PHA
                this.stackPush(this.state.a);
                break;
            // PHP
            case 0x08: // PHP
                // this.stackPush(this.state.getStatusFlag() | 0x10); setar breakFlag?
                this.stackPush(this.state.getStatusFlag());
                break;
            // PLA
            case 0x68:
                this.state.a = this.stackPop();
                this.setArithmeticFlags(this.state.a);
                break;
            // PLP
            case 0x28:
                this.setProcessorStatus(this.stackPop());
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
                    this.state.a = this.sbcDecimal(this.state.a, this.bus.read(effectiveAddress, true));
                } else {
                    this.state.a = this.sbc(this.state.a, this.bus.read(effectiveAddress, true));
                }
                break;
            // STA
            case 0x81: // (Zero Page,X)
            case 0x85: // Zero Page
            case 0x8d: // Absolute
            case 0x91: // (Zero Page),Y
            case 0x95: // Zero Page,X
            case 0x99: // Absolute,Y
            case 0x9d: // Absolute,X
                this.bus.write(effectiveAddress, this.state.a);
                break;
            // STX
            case 0x86: // Zero Page
            case 0x8e: // Absolute
            case 0x96: // Zero Page,Y
                this.bus.write(effectiveAddress, this.state.x);
                break;
            // STY
            case 0x84: // Zero Page
            case 0x8c: // Absolute
            case 0x94: // Zero Page,X
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
            default:
                implemented = false;
                this.state.noOp = true;

        }

        if (this.state.ir !== 0x00) {
            const text = this.state.toTraceEvent();
            const formattedText = implemented ? chalk.green(text) : chalk.red(text);
            console.log(formattedText);
        }
    }

    private peekAhead(): void {

        this.state.nextIr = this.bus.read(this.state.pc, true);

        const nextInstSize = instructionSizes[this.state.nextIr];

        for (let i = 1; i < nextInstSize; i++) {
            const nextRead = (this.state.pc + i) % this.bus.endAddress;
            this.state.nextArgs[i - 1] = this.bus.read(nextRead, true);
        }
    }

    private handleBrk(returnPc: number): void {
        this.handleInterrupt(returnPc, IRQ_VECTOR_L, IRQ_VECTOR_H, true);
        this.state.irqAsserted = false;
    }

    private handleIrq(returnPc: number): void {
        this.handleInterrupt(returnPc, IRQ_VECTOR_L, IRQ_VECTOR_H, false);
        this.state.irqAsserted = false;
    }

    private handleNmi(): void {
        this.handleInterrupt(this.state.pc, NMI_VECTOR_L, NMI_VECTOR_H, false);
        this.state.nmiAsserted = false;
    }

    private handleInterrupt(returnPc: number, vectorLow: number, vectorHigh: number, isBreak: boolean): void {

        this.state.breakFlag = isBreak;

        this.stackPush((returnPc >> 8) & 0xff);
        this.stackPush(returnPc & 0xff);
        this.stackPush(this.state.getStatusFlag());

        this.state.irqDisableFlag = true;

        this.state.pc = address(this.bus.read(vectorLow, true), this.bus.read(vectorHigh, true));
    }

    public stackPush(data: number) {
        // TODO: use constant instead
        this.bus.write(0x100 + this.state.sp, data);

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

        // TODO: use constant instead
        return this.bus.read(0x100 + this.state.sp, true);
    }

    public stackPeek() {
        // TODO: use constant instead
        return this.bus.read(0x100 + this.state.sp + 1, true);
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
        // TODO: use constant instead
        this.state.pc = (this.state.pc + 1) % 0x10000;
    }

    private relAddress(offset: number) {
        // Cast the offset to a signed byte to handle negative offsets
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

        const opCode = this.bus.read(addr, true);
        const args = [0, 0];

        const size = instructionSizes[opCode];
        for (let i = 1; i < size; i++) {
            const nextRead = (addr + i) % this.bus.endAddress;
            args[i - 1] = this.bus.read(nextRead, true);
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

    private adc(acc: number, operand: number): number {
        var result = (operand & 0xff) + (acc & 0xff) + this.getCarryBit();
        var carry6 = (operand & 0x7f) + (acc & 0x7f) + this.getCarryBit();
        this.state.carryFlag = (result & 0x100) != 0;
        this.state.overflowFlag = ((this.state.carryFlag ? 1 : 0) ^ (((carry6 & 0x80) != 0) ? 1 : 0)) ? true : false;
        result &= 0xff;
        this.setArithmeticFlags(result);
        return result;
    }

    
    private adcDecimal(acc: number, operand: number): number {
        var l, h, result;
        l = (acc & 0x0f) + (operand & 0x0f) + this.getCarryBit();
        if ((l & 0xff) > 9) l += 6;
        h = (acc >> 4) + (operand >> 4) + (l > 15 ? 1 : 0);
        if ((h & 0xff) > 9) h += 6;
        result = (l & 0x0f) | (h << 4);
        result &= 0xff;
        this.state.carryFlag = h > 15;
        this.state.zeroFlag = result == 0;
        this.state.overflowFlag = false;
        this.state.negativeFlag = false;

        return result;
    }

    private sbc(acc: number, operand: number): number {
        var result = this.adc(acc, ~operand);
        this.setArithmeticFlags(result);
        return result;
    }

    private sbcDecimal(acc: number, operand: number): number {
        var l, h, result;
        l = (acc & 0x0f) - (operand & 0x0f) - (this.state.carryFlag ? 0 : 1);
        if ((l & 0x10) != 0) l -= 6;
        h = (acc >> 4) - (operand >> 4) - ((l & 0x10) != 0 ? 1 : 0);
        if ((h & 0x10) != 0) h -= 6;
        result = (l & 0x0f) | (h << 4) & 0xff;
        this.state.carryFlag = (h & 0xff) < 15;
        this.state.zeroFlag = result == 0;
        this.state.overflowFlag = false;
        this.state.negativeFlag = false;

        return (result & 0xff);
    }

    private getCarryBit(): number {
        return (this.state.carryFlag ? 1 : 0);
    }

    private setArithmeticFlags(result: number): void {
        this.state.zeroFlag = (result == 0);
        this.state.negativeFlag = (result & 0x80) != 0;
    }
}
