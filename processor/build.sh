asm6f -L $1.asm && dcc6502 $1.bin > $1.dasm
grep -v BRK $1.dasm > $1.gdasm
ts-node src/cli.ts $1.bin
grep -v '\t0x00' $1.bin.dump > $1.bin.gdump
