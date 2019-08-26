ASM=$1
NES="${ASM%.*}.nes"

rm -f $NES
nesasm $ASM
mednafen $NES
