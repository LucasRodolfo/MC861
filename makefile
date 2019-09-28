EXECUTAR=ts-node ./src/cli.ts

TST=./tst
RES=./res
BIN=./bin
LOG=./log
EXT=./ext
NES=./bin/

TESTS=$(addprefix ${BIN}/, $(notdir $(patsubst %.s,%,$(sort $(wildcard ${TST}/*.s)))))
CROSS_AS=${EXT}/asm6/asm6

all: ${BIN} ${LOG} ${NES}

${NES}:
	${TSNODE} ${MAIN} ${NES}

${BIN}:
	@mkdir -p ${BIN}

${BIN}/%: ${TST}/%.s
	gcc -o ./ext/asm6/asm6 ./ext/asm6/asm6.c
	${CROSS_AS} $^ $@

${LOG}:
	@mkdir -p ${LOG}

test: ${BIN} ${LOG} ${NES} ${TESTS}
	@{  echo "************************* Tests ******************************"; \
		test_failed=0; \
		test_passed=0; \
		pwd; \
		for test in ${TESTS}; do \
			result="${LOG}/$$(basename $$test).log"; \
			expected="${RES}/$$(basename $$test).r"; \
			printf "Running $$test: "; \
			cd processor; \
			${EXECUTAR} ../$$test > ../$$result 2>&1; \
			cd ..; \
			errors=`diff -y --suppress-common-lines $$expected $$result | grep '^' | wc -l`; \
			if [ "$$errors" -eq 0 ]; then \
				printf "\033[0;32mPASSED\033[0m\n"; \
				test_passed=$$((test_passed+1)); \
			else \
				printf "\033[0;31mFAILED [$$errors errors]\033[0m\n"; \
				test_failed=$$((test_failed+1)); \
			fi; \
		done; \
		echo "*********************** Summary ******************************"; \
		echo "- $$test_passed tests passed"; \
		echo "- $$test_failed tests failed"; \
		echo "**************************************************************"; \
	}

setup:
	apt-get install nodejs
	npm install -g typescript
	npm install -g ts-node
	cd processor
	npm install
	cd ..
clean:
	rm -rf ${BIN}/* ${LOG}/*
	rm -f ./ext/asm6/asm6
