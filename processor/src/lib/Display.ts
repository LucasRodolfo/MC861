import {SCREEN_WIDTH, SCREEN_HEIGHT} from './constants';

export class Display {

    private ctx: CanvasRenderingContext2D;

    private data: ImageData;
    private uint32: Uint32Array;

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d');

        canvas.width = SCREEN_WIDTH;
        canvas.height = SCREEN_HEIGHT;

        this.data = this.ctx.createImageData(canvas.width, canvas.height);
        this.uint32 = new Uint32Array(this.data.data.buffer);
    }

    public renderPixel(x: number, y: number, c: number) {
        const index = y * this.canvas.width + x;
        this.uint32[index] = c;
    }

    public updateScreen(): void {
        this.ctx.putImageData(this.data, 0, 0);
    }
}
