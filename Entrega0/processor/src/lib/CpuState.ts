import {sprintf} from 'sprintf-js';
import {byteToHex, wordToHex} from './utils';
import {disassembleOp, instructionSizes} from './disassembler';
import {P_BREAK, P_CARRY, P_DECIMAL, P_IRQ_DISABLE, P_NEGATIVE, P_OVERFLOW, P_ZERO} from './constants';

export class CpuState {

    public a: number;

    public x: number;

    public y: number;

    public sp: number;

    public pc: number;

    public ir: number;

    public nextIr: number;
    public args: number[] = [0, 0];
    public nextArgs: number[] = [0, 0];
    public instSize: number;
    public opTrap: boolean;
    public irqAsserted: boolean;
    public nmiAsserted: boolean;
    public lastPc: number;

    public carryFlag: boolean;
    public negativeFlag: boolean;
    public zeroFlag: boolean;
    public irqDisableFlag: boolean;
    public decimalModeFlag: boolean;
    public breakFlag: boolean;
    public overflowFlag: boolean;
    public stepCounter: number = 0;

    public constructor(state: CpuState = null) {
        if (state) {
            this.a = state.a;
            this.x = state.x;
            this.y = state.y;
            this.sp = state.sp;
            this.pc = state.pc;
            this.ir = state.ir;
            this.nextIr = state.nextIr;
            this.lastPc = state.lastPc;
            this.args = state.args.slice(0, 2);
            this.nextArgs = state.nextArgs.slice(0, 2);
            this.instSize = state.instSize;
            this.opTrap = state.opTrap;
            this.irqAsserted = state.irqAsserted;
            this.carryFlag = state.carryFlag;
            this.negativeFlag = state.negativeFlag;
            this.zeroFlag = state.zeroFlag;
            this.irqDisableFlag = state.irqDisableFlag;
            this.decimalModeFlag = state.decimalModeFlag;
            this.breakFlag = state.breakFlag;
            this.overflowFlag = state.overflowFlag;
            this.stepCounter = state.stepCounter;
        }
    }

    toTraceEvent(): string {
        return this.getInstructionByteStatus() + '  ' +
            sprintf('%-14s', disassembleOp(this.ir, this.args)) +
            'A:' + byteToHex(this.a) + ' ' +
            'X:' + byteToHex(this.x) + ' ' +
            'Y:' + byteToHex(this.y) + ' ' +
            'F:' + byteToHex(this.getStatusFlag()) + ' ' +
            'S:1' + byteToHex(this.sp) + ' ' +
            this.getProcessorStatusString() + '\n';
    }

    getStatusFlag(): number {
        let status = 0x20;
        if (this.carryFlag) {
            status |= P_CARRY;
        }
        if (this.zeroFlag) {
            status |= P_ZERO;
        }
        if (this.irqDisableFlag) {
            status |= P_IRQ_DISABLE;
        }
        if (this.decimalModeFlag) {
            status |= P_DECIMAL;
        }
        if (this.breakFlag) {
            status |= P_BREAK;
        }
        if (this.overflowFlag) {
            status |= P_OVERFLOW;
        }
        if (this.negativeFlag) {
            status |= P_NEGATIVE;
        }
        return status;
    }

    getInstructionByteStatus(): string {
        switch (instructionSizes[this.ir]) {
            case 0:
            case 1:
                return wordToHex(this.lastPc) + '  ' +
                    byteToHex(this.ir) + '      ';
            case 2:
                return wordToHex(this.lastPc) + '  ' +
                    byteToHex(this.ir) + ' ' +
                    byteToHex(this.args[0]) + '   ';
            case 3:
                return wordToHex(this.lastPc) + '  ' +
                    byteToHex(this.ir) + ' ' +
                    byteToHex(this.args[0]) + ' ' +
                    byteToHex(this.args[1]);
            default:
                return null;
        }
    }

    getProcessorStatusString(): string {
        return '[' + (this.negativeFlag ? 'N' : '.') +
            (this.overflowFlag ? 'V' : '.') +
            '-' +
            (this.breakFlag ? 'B' : '.') +
            (this.decimalModeFlag ? 'D' : '.') +
            (this.irqDisableFlag ? 'I' : '.') +
            (this.zeroFlag ? 'Z' : '.') +
            (this.carryFlag ? 'C' : '.') +
            ']';
    }
}
