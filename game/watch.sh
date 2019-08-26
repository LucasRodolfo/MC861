ASM=$1

./run.sh $ASM
fswatch -o $ASM | xargs -n1 -I{} ./run.sh $ASM
