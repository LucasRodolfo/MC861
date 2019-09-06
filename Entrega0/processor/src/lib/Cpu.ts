import {CpuState} from './CpuState';
import {Bus} from './Bus';
import {disassembleOp, instructionClocksNmos, instructionSizes} from './disassembler';
import {address, nanoseconds} from './utils';

import {
    DEFAULT_CLOCK_PERIOD_IN_NS,
    P_BREAK,
    P_CARRY,
    P_DECIMAL,
    P_IRQ_DISABLE,
    P_NEGATIVE,
    P_OVERFLOW,
    P_ZERO, RST_VECTOR_H, RST_VECTOR_L
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

        this.state.opTrap = false;

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

        // this.state.ir = this.bus.read(this.state.pc, true);

        const irAddressMode = (this.state.ir >> 2) & 0x07;  // Bits 3-5 of IR:  [ | | |X|X|X| | ]
        const irOpMode = this.state.ir & 0x03;              // Bits 6-7 of IR:  [ | | | | | |X|X]

        this.incrementPC();

        this.state.opTrap = false;

        this.state.instSize = instructionSizes[this.state.ir];
        for (let i = 0; i < this.state.instSize - 1; i++) {
            this.state.args[i] = this.bus.read(this.state.pc, true);
            this.incrementPC();
        }

        this.state.stepCounter++;

        const effectiveAddress = this.calculateEffectiveAddress(irOpMode, irAddressMode);

        switch (this.state.ir) {
            // TODO

            default:
                this.state.opTrap = true;
                break;
        }

        this.delayLoop(this.state.ir);

        this.peekAhead();
    }

    calculateEffectiveAddress(irOpMode: number, irAddressMode: number): number {
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

    private peekAhead(): void {
        // TODO
    }

    private handleBrk(returnPc: number): void {
        // TODO
    }

    private handleIrq(returnPc: number): void {
        // TODO
    }

    private handleNmi(): void {
        // TODO
    }

    private handleInterrupt(returnPc: number, vectorLow: number, vectorHigh: number, isBreak: boolean): void {
        // TODO
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
        this.state.irqDisableFlag = (value & P_IRQ_DISABLE) != 0;
        this.state.decimalModeFlag = (value & P_DECIMAL) !== 0;
        this.state.breakFlag = (value & P_BREAK) !== 0;
        this.state.overflowFlag = (value & P_OVERFLOW) !== 0;
        this.state.negativeFlag = (value & P_NEGATIVE) !== 0;
    }


    private incrementPC(): void {
        // TODO
    }

    private delayLoop(opcode: number): void {

        const clockSteps = instructionClocksNmos[0xff & opcode];

        if (clockSteps == 0) {
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

    public disassembleOpAtAddress(address: number): string {
        // TODO
        return '';
    }
}
