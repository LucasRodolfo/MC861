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
            console.log(this.state.args[i]);
            this.incrementPC();
        }

        this.state.stepCounter++;
        //Usado para testar o TAX
        //this.state.zeroFlag = false;
        //this.state.a = this.state.pc;
        //this.state.carryFlag = true;
        //this.state.negativeFlag = true;
        //this.state.overflowFlag = true;
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

            //Nao testei ainda (Lucas)
            //case 0x00: // BRK - Force Interrupt - Implied
            //  this.handleBrk(this.state.pc + 1);
            //  break;

            // TAX
            case 0xaa:
                this.state.x = this.state.a;
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
            //NAO TESTADO AINDA!
            case 0x40: // RTI - Return from Interrupt - Implied
                this.setProcessorStatus(this.stackPop());
                var lo = this.stackPop();
                var hi = this.stackPop();
                this.setProgramCounter(address(lo, hi));
                break;

            case 0x60: // RTS - Return from Subroutine - Implied
                lo = this.stackPop();
                hi = this.stackPop();
                this.setProgramCounter((address(lo, hi) + 1) & 0xffff);
                break;
            //NAO TESTADO AINDA!
            case 0x20: // JSR - Jump to Subroutine - Implied
                this.stackPush((this.state.pc - 1 >> 8) & 0xff); // PC high byte
                this.stackPush(this.state.pc - 1 & 0xff);        // PC low byte
                this.state.pc = address(this.state.args[1],this.state.args[0]);

                break;
            // /** JMP *****************************************************************/
            // case 0x4c: // JMP - Absolute
            //     thi.state.pc = address(this.state.args[0], this.state.args[1]);
            //     break;
            // case 0x6c: // JMP - Indirect
            //     lo = address(this.state.args[0], this.state.args[1]); // Address of low byte
            //
            //     if (this.state.args[0] == 0xff) {
            //         hi = address(0x00, this.state.args[1]);
            //     } else {
            //         hi = lo + 1;
            //     }
            //
            //     this.state.pc = address(bus.read(lo, true), bus.read(hi, true));
            //     break;
            // case 0x7c: // 65C02 JMP - (Absolute Indexed Indirect,X)
            //     break;
            //     lo = (((this.state.args[1] << 8) | this.state.args[0]) + this.state.x) & 0xffff;
            //     hi = lo + 1;
            //     this.state.pc = address(bus.read(lo, true), bus.read(hi, true));
            //     break;

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
}
