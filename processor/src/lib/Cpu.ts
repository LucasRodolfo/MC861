import chalk from 'chalk';

import {Bus} from './Bus';
import {CpuState} from './CpuState';
import {disassembleOp, instructionClocksNmos, instructionSizes} from './disassembler';
import {address, nanoseconds, wordToHex, byteToHex} from './utils';

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

        this.state.a = this.state.pc;
        this.runInstruction(currentPC, irAddressMode, irOpMode);

        // Print system state
        console.log(`| pc = ${this.state.pc} | a = ${this.state.a} | x = ${this.state.x} | y = ${this.state.y} | sp = ${this.state.sp} |`)
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

        switch (byteToHex(this.state.ir)) {
            case '0xaa':    //TAX
                this.state.x = this.state.a;
                break;
            default:
                implemented = false;
                this.state.noOp = true;
        }

        const text = this.state.toTraceEvent();
        const formattedText = implemented ? chalk.green(text) : chalk.red(text);
        console.log(formattedText);
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
}
