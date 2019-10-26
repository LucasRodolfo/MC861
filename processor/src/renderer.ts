// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import {remote} from 'electron';

import {Nes} from './lib/Nes';

run()
    .then(() => {})
    .catch((err: Error) => console.error(err));

async function run(): Promise<void> {
    const canvas = document.getElementById('canvas');

    const nes = new Nes();

    await nes.load(remote.process.argv[2], canvas as HTMLCanvasElement);

    await nes.run();
}
