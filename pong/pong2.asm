;----------------------------------------------------------------
; iNES header
;----------------------------------------------------------------

  .inesprg 1   ; 1x 16KB PRG code
  .ineschr 1   ; 1x  8KB CHR data
  .inesmap 0   ; mapper 0 = NROM, no bank swapping
  .inesmir 1   ; background mirroring

;----------------------------------------------------------------
; constants
;----------------------------------------------------------------

  STATETITLE     = $00  ; displaying title screen
  STATEPLAYING   = $01  ; move paddles/ball, check for collisions
  STATEGAMEOVER  = $02  ; displaying game over screen
  RIGHTWALL      = $F4  ; when ball reaches one of these, do something
  TOPWALL        = $20
  BOTTOMWALL     = $E0
  LEFTWALL       = $04
  PADDLE1X       = $18  ; horizontal position for paddles, doesnt move
  PADDLE1XADJUST = $20
  PADDLE2X       = $E0

;----------------------------------------------------------------
; variables
;----------------------------------------------------------------

  .enum $0000  ;;start variables at ram location 0
  gamestate     .dsb 1  ; .dsb 1 means reserve one byte of space
  ballx         .dsb 1  ; ball horizontal position
  bally         .dsb 1  ; ball vertical position
  ballup        .dsb 1  ; 1 = ball moving up
  balldown      .dsb 1  ; 1 = ball moving down
  ballleft      .dsb 1  ; 1 = ball moving left
  ballright     .dsb 1  ; 1 = ball moving right
  ballspeedx    .dsb 1  ; ball horizontal speed per frame
  ballspeedy    .dsb 1  ; ball vertical speed per frame
  paddlespeedy    .dsb 1
  paddle1ytop   .dsb 1  ; player 1 paddle top vertical position
  paddle1ybot   .dsb 1
  paddle2ytop   .dsb 1  ; player 2 paddle bottom vertical position
  paddle2ybot   .dsb 1
  buttons1      .dsb 1  ; player 1 gamepad buttons, one bit per button
  buttons2      .dsb 1  ; player 2 gamepad buttons, one bit per button
  scoreOnes     .dsb 1  ; byte for each digit in the decimal score
  scoreTens     .dsb 1
  scoreHundreds .dsb 1
  scorePlayer1  .dsb 1
  scorePlayer2  .dsb 1
  contadorloop  .dsb 1  ; variavel para loop
  .ende

;----------------------------------------------------------------
; program bank(s) - code
;----------------------------------------------------------------

  .base $10000-($4000)

RESET:
  SEI          ; disable IRQs
  CLD          ; disable decimal mode
  LDX #$40
  STX $4017    ; disable APU frame IRQ
  LDX #$FF
  TXS          ; Set up stack
  INX          ; now X = 0
  STX $2000    ; disable NMI
  STX $2001    ; disable rendering
  STX $4010    ; disable DMC IRQs

vblankwait1:       ; First wait for vblank to make sure PPU is ready
  BIT $2002
  BPL vblankwait1

clrmem:
  LDA #$00
  STA $0000, x
  STA $0100, x
  STA $0300, x
  STA $0400, x
  STA $0500, x
  STA $0600, x
  STA $0700, x
  LDA #$FE
  STA $0200, x
  INX
  BNE clrmem

vblankwait2:      ; Second wait for vblank, PPU is ready after this
  BIT $2002
  BPL vblankwait2

LoadPalettes:
  LDA $2002             ; read PPU status to reset the high/low latch
  LDA #$3F
  STA $2006             ; write the high byte of $3F00 address
  LDA #$00
  STA $2006             ; write the low byte of $3F00 address
  LDX #$00              ; start out at 0
LoadPalettesLoop:
  LDA palette, x        ; load data from address (palette + the value in x)
                          ; 1st time through loop it will load palette+0
                          ; 2nd time through loop it will load palette+1
                          ; 3rd time through loop it will load palette+2
                          ; etc
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$20              ; Compare X to hex $10, decimal 16 - copying 16 bytes = 4 sprites
  BNE LoadPalettesLoop  ; Branch to LoadPalettesLoop if compare was Not Equal to zero
                        ; if compare was equal to 32, keep going down

;;;Set some initial ball stats
InitialValues:
  LDA #$01
  STA balldown
  STA ballright
  LDA #$00
  STA ballup
  STA ballleft
  LDA #$50
  STA bally
  LDA #$80
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy

  LDA #$70
  STA paddle1ybot
  STA paddle2ybot
  LDA #$90
  STA paddle1ytop
  STA paddle2ytop

;;;Set initial score value
  LDA #$00
  STA scoreOnes
  STA scoreTens
  STA scoreHundreds

;;:Set starting game state
  LDA #STATEPLAYING
  STA gamestate
  LDA #%10010000   ; enable NMI, sprites from Pattern Table 0, background from Pattern Table 1
  STA $2000
  LDA #%00011110   ; enable sprites, enable background, no clipping on left side
  STA $2001

Forever:
  JMP Forever     ;jump back to Forever, infinite loop, waiting for NMI

NMI:
  LDA #$00
  STA $2003       ; set the low byte (00) of the RAM address
  LDA #$02
  STA $4014       ; set the high byte (02) of the RAM address, start the transfer
  JSR DrawScore
  ;;This is the PPU clean up section, so rendering the next frame starts properly.
  LDA #%10010000   ; enable NMI, sprites from Pattern Table 0, background from Pattern Table 1
  STA $2000
  LDA #%00011110   ; enable sprites, enable background, no clipping on left side
  STA $2001
  LDA #$00        ;;tell the ppu there is no background scrolling
  STA $2005
  STA $2005
  ;;;all graphics updates done by here, run game engine
  JSR ReadController1  ;;get the current button data for player 1
  JSR ReadController2  ;;get the current button data for player 2

GameEngine:
  LDA gamestate
  CMP #STATETITLE
  BEQ EngineTitle    ;;game is displaying title screen
  LDA gamestate
  CMP #STATEGAMEOVER
  BEQ EngineGameOver  ;;game is displaying ending screen
  LDA gamestate
  CMP #STATEPLAYING
  BEQ EnginePlaying   ;;game is playing
GameEngineDone:
  JSR UpdateSprites  ;;set ball/paddle sprites from positions
  RTI             ; return from interrupt

EngineTitle:
  ;;if start button pressed
  ;;  turn screen off
  ;;  load game screen
  ;;  set starting paddle/ball position
  ;;  go to Playing State
  ;;  turn screen on
  JMP GameEngineDone

EngineGameOver:
  ;;if start button pressed
  ;;  turn screen off
  ;;  load title screen
  ;;  go to Title State
  ;;  turn screen on
  JMP GameEngineDone

EnginePlaying:

MoveBallRight:
  LDA ballright
  BEQ MoveBallRightDone   ;;if ballright=0, skip this section
  LDA ballx
  CLC
  ADC ballspeedx        ;;ballx position = ballx + ballspeedx
  STA ballx
  LDA ballx
  CMP #RIGHTWALL
  BCC MoveBallRightDone      ;;if ball x < right wall, still on screen, skip next section
  ;LDA #$00
  ;STA ballright
  ;LDA #$01
  ;STA ballleft         ;;bounce, ball now moving left
  ;;in real game, give point to player 1, reset ball
  LDA #$00
  STA balldown
  STA ballright
  STA ballup
  STA ballleft
  LDX scorePlayer1
  INX
  TXA
  STA scorePlayer1
  jsr IncrementScore
  LDA #$01
  STA balldown
  STA ballright
  LDA #$00
  STA ballup
  STA ballleft
  LDA #$50
  STA bally
  LDA #$80
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy

  LDA #$70
  STA paddle1ybot
  STA paddle2ybot
  LDA #$90
  STA paddle1ytop
  STA paddle2ytop

MoveBallRightDone:

MoveBallLeft:
  LDA ballleft
  BEQ MoveBallLeftDone   ;;if ballleft=0, skip this section
  LDA ballx
  SEC
  SBC ballspeedx        ;;ballx position = ballx - ballspeedx
  STA ballx
  LDA ballx
  CMP #LEFTWALL
  BCS MoveBallLeftDone      ;;if ball x > left wall, still on screen, skip next section
  ;LDA #$01
  ;STA ballright
  ;LDA #$00
  ;STA ballleft         ;;bounce, ball now moving right
  ;;in real game, give point to player 2, reset ball
  LDX scorePlayer2
  INX
  TXA
  STA scorePlayer2
  jsr IncrementScore
  LDA #$01
  STA ballup
  STA ballleft
  LDA #$00
  STA balldown
  STA ballright
  LDA #$50
  STA bally
  LDA #$80
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy

  LDA #$70
  STA paddle1ybot
  STA paddle2ybot
  LDA #$90
  STA paddle1ytop
  STA paddle2ytop
MoveBallLeftDone:

MoveBallUp:
  LDA ballup
  BEQ MoveBallUpDone   ;;if ballup=0, skip this section
  LDA bally
  SEC
  SBC ballspeedy        ;;bally position = bally - ballspeedy
  STA bally
  LDA bally
  CMP #TOPWALL
  BCS MoveBallUpDone      ;;if ball y > top wall, still on screen, skip next section
  LDA #$01
  STA balldown
  LDA #$00
  STA ballup         ;;bounce, ball now moving down
MoveBallUpDone:

MoveBallDown:
  LDA balldown
  BEQ MoveBallDownDone   ;;if ballup=0, skip this section
  LDA bally
  CLC
  ADC ballspeedy        ;;bally position = bally + ballspeedy
  STA bally
  LDA bally
  CMP #BOTTOMWALL
  BCC MoveBallDownDone      ;;if ball y < bottom wall, still on screen, skip next section
  LDA #$00
  STA balldown
  LDA #$01
  STA ballup         ;;bounce, ball now moving down
MoveBallDownDone:

MovePaddle1Up:
  ;;if up button pressed
  ;;  if paddle top > top wall
  ;;    move paddle top and bottom up
  LDA buttons1
  AND #%00001000
  TAX
  CPX #$00
  BEQ MovePaddle1UpDone
  LDA paddle1ybot
  CMP #TOPWALL
  BCC MovePaddle1UpDone
  LDA paddle1ybot
  SBC paddlespeedy
  STA paddle1ybot
  LDA paddle1ytop
  SBC paddlespeedy
  STA paddle1ytop
MovePaddle1UpDone:
MovePaddle2Up:
  LDA buttons2
  AND #%00001000
  TAX
  CPX #$00
  BEQ MovePaddle2UpDone
  LDA paddle2ybot
  CMP #TOPWALL
  BCC MovePaddle2UpDone
  LDA paddle2ybot
  SBC paddlespeedy
  STA paddle2ybot
  LDA paddle2ytop
  SBC paddlespeedy
  STA paddle2ytop
MovePaddle2UpDone:

MovePaddle1Down:
  ;;if down button pressed
  ;;  if paddle bottom < bottom wall
  ;;    move paddle top and LDA #$10
 ; STA paddle2ybot
  ;LDA #$30
  ;STA paddle2ytopbottom down

  LDA buttons1
  AND #%00000100
  TAX
  CPX #$00
  BEQ MovePaddle1DownDone
  LDA paddle1ytop
  CMP #BOTTOMWALL
  BCS MovePaddle1DownDone
  LDA paddle1ybot
  CLC
  ADC paddlespeedy
  STA paddle1ybot
  LDA paddle1ytop
  CLC
  ADC paddlespeedy
  STA paddle1ytop
MovePaddle1DownDone:
MovePaddle2Down:
  LDA buttons2
  AND #%00000100
  TAX
  CPX #$00
  BEQ MovePaddle2DownDone
  LDA paddle2ytop
  CMP #BOTTOMWALL
  BCS MovePaddle2DownDone
  LDA paddle2ybot
  CLC
  ADC paddlespeedy
  STA paddle2ybot
  LDA paddle2ytop
  CLC
  ADC paddlespeedy
  STA paddle2ytop
MovePaddle2DownDone:

CheckPaddleCollision:
  ;;if ball x < paddle1x
  ;;  if ball y > paddle y top
  ;;    if ball y < paddle y bottom
  ;;      bounce, ball now moving left
Paddle1Collision:
  LDA ballx
  CMP #PADDLE1XADJUST
  BCS Paddle1CollisionDone
  LDA bally
  CMP paddle1ybot
  BCC Paddle1CollisionDone
  LDA bally
  CMP paddle1ytop
  BCS Paddle1CollisionDone
  LDA #$01
  STA ballright
  LDA #$00
  STA ballleft
Paddle1CollisionDone:
Paddle2Collision:
  LDA ballx
  CMP #PADDLE2X
  BCC Paddle2CollisionDone
  LDA bally
  CMP paddle2ybot
  BCC Paddle2CollisionDone
  LDA bally
  CMP paddle2ytop
  BCS Paddle2CollisionDone
  LDA #$00
  STA ballright
  LDA #$01
  STA ballleft
Paddle2CollisionDone:
CheckPaddleCollisionDone:

  JMP GameEngineDone

UpdateSprites:
  LDA bally  ;;update all ball sprite info
  STA $0200
  LDA #$30
  STA $0201
  LDA #$00
  STA $0202
  LDA ballx
  STA $0203
  ;;update paddle sprites
DrawPaddle1:
  LDX paddle1ybot
  LDY #$00
DrawPaddle1Loop:
  TXA
  STA #$0204, y
  INY
  LDA #$31
  STA $0204, y
  INY
  LDA #$00
  STA $0204, y
  INY
  LDA #PADDLE1X
  STA $0204, y
  INY
  TXA
  CLC
  ADC #$08
  TAX
  CPX paddle1ytop
  BNE DrawPaddle1Loop
DrawPaddle2:
  LDX paddle2ybot
DrawPaddle2Loop:
  TXA
  STA #$0204, y
  INY
  LDA #$31
  STA $0204, y
  INY
  LDA #$00
  STA $0204, y
  INY
  LDA #PADDLE2X
  STA $0204, y
  INY
  TXA
  CLC
  ADC #$08
  TAX
  CPX paddle2ytop
  BNE DrawPaddle2Loop
  RTS

DrawScore:
  LDA $2002
  LDA #$20
  STA $2006
  LDA #$20
  STA $2006          ; start drawing the score at PPU $2020
  LDA scoreHundreds  ; get first digit
;  CLC
;  ADC #$30           ; add ascii offset  (this is UNUSED because the tiles for digits start at 0)
  STA $2007          ; draw to background
  LDA scoreTens      ; next digit
;  CLC
;  ADC #$30           ; add ascii offset
  STA $2007
  LDA scoreOnes      ; last digit
;  CLC
;  ADC #$30           ; add ascii offset
  STA $2007
  RTS

IncrementScore:
IncOnes:
  LDA scoreOnes      ; load the lowest digit of the number
  CLC
  ADC #$01           ; add one
  STA scoreOnes
  CMP #$05
  BEQ Play_winners
  JSR Score_sound
  CMP #$0A           ; check if it overflowed, now equals 10
  BNE IncDone        ; if there was no overflow, all done
IncTens:
  LDA #$00
  STA scoreOnes      ; wrap digit to 0
  LDA scoreTens      ; load the next digit
  CLC
  ADC #$01           ; add one, the carry from previous digit
  STA scoreTens
  CMP #$0A           ; check if it overflowed, now equals 10
  BNE IncDone        ; if there was no overflow, all done
IncHundreds:
  LDA #$00
  STA scoreTens      ; wrap digit to 0
  LDA scoreHundreds  ; load the next digit
  CLC
  ADC #$01           ; add one, the carry from previous digit
  STA scoreHundreds
IncDone:

ReadController1:
  LDA #$01
  STA $4016
  LDA #$00
  STA $4016
  LDX #$08
ReadController1Loop:
  LDA $4016
  LSR A            ; bit0 -> Carry
  ROL buttons1     ; bit0 <- Carry
  DEX
  BNE ReadController1Loop
  RTS

ReadController2:
  LDA #$01
  STA $4016
  LDA #$00
  STA $4016
  LDX #$08
ReadController2Loop:
  LDA $4017
  LSR A            ; bit0 -> Carry
  ROL buttons2     ; bit0 <- Carry
  DEX
  BNE ReadController2Loop
  RTS

Play_winners:
  JSR Play_winnersound
  RTS

Score_sound:
SoundScore1:
  lda #%00000001  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  ;Square 1
  lda #%00111000  ;Duty 00, Volume 8 (half volume)
  sta $4000
  lda #$A9        ;$0A9 is a Mi in NTSC mode
  sta $4002       ;low 8 bits of period
  lda #$00
  sta $4003       ;high 3 bits of period
  JSR Start_fake_loop_30p
SoundScore2:
  ;Square 2
  lda #%00000011  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  lda #%01110110  ;Duty 01, Volume 6
  sta $4004
  lda #$8E        ;$046 is an Sol in NTSC mode
  sta $4006
  lda #$00
  sta $4007
  JSR Start_fake_loop_30p
SoundScore3:
  ;Triangle
  lda #%00000111  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  lda #%10000001  ;Triangle channel on
  sta $4008
  lda #$3F        ;$01F is a Lá in NTSC mode
  sta $400A
  lda #$00
  sta $400B
  JSR Start_fake_loop_30p
  RTS

Play_winnersound:
  JSR Sound1
  JSR Start_fake_loop_30p
  JSR Sound1
  JSR Start_fake_loop_30p
  JSR Sound2
  JSR Start_fake_loop
  JSR Sound3
  JSR Start_fake_loop_30p
  JSR Sound3
  JSR Start_fake_loop_30p
  JSR Sound4
  JSR Start_fake_loop
  JSR Sound1
  JSR Start_fake_loop_30p
  JSR Sound1
  JSR Start_fake_loop_30p
  JSR Sound2
  JSR Start_fake_loop
  JSR Sound3
  JSR Start_fake_loop_30p
  JSR Sound3
  JSR Start_fake_loop_30p
  JSR Sound4
  JSR Start_fake_loop

  RTS

Winner_sound:
Sound1:
  lda #%00000111  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  ;Square 1
  lda #%00111000  ;Duty 00, Volume 8 (half volume)
  sta $4000
  lda #$7E        ;$7E is a Lá in NTSC mode
  sta $4002       ;low 8 bits of period
  lda #$00
  sta $4003       ;high 3 bits of period
  ;Square 2
  lda #%01110110  ;Duty 01, Volume 6
  sta $4004
  lda #$5E        ;$5E is an Ré in NTSC mode
  sta $4006
  lda #$00
  sta $4007
  ;Triangle
  lda #%10000001  ;Triangle channel on
  sta $4008
  lda #$4B        ;$4B is a Solb in NTSC mode
  sta $400A
  lda #$00
  sta $400B
  JSR Start_fake_loop_half
  RTS
Sound2:
  lda #%00000111  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  ;Square 1
  lda #%00111000  ;Duty 00, Volume 8 (half volume)
  sta $4000
  lda #$7E        ;$7E is a Lá in NTSC mode
  sta $4002       ;low 8 bits of period
  lda #$00
  sta $4003       ;high 3 bits of period
  ;Square 2
  lda #%01110110  ;Duty 01, Volume 6
  sta $4004
  lda #$64        ;$64 is an Réb in NTSC mode
  sta $4006
  lda #$00
  sta $4007
  ;Triangle
  lda #%10000001  ;Triangle channel on
  sta $4008
  lda #$54        ;$54 is a Mi in NTSC mode
  sta $400A
  lda #$00
  sta $400B
  JSR fake_loop
  JSR Start_fake_loop
  RTS
Sound3:
  lda #%00000111  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  ;Square 1
  lda #%00111000  ;Duty 00, Volume 8 (half volume)
  sta $4000
  lda #$8E        ;$8E is a Sol in NTSC mode
  sta $4002       ;low 8 bits of period
  lda #$00
  sta $4003       ;high 3 bits of period
  ;Square 2
  lda #%01110110  ;Duty 01, Volume 6
  sta $4004
  lda #$D2        ;$D2 is an Dó in NTSC mode
  sta $4006
  lda #$00
  sta $4007
  ;Triangle
  lda #%10000001  ;Triangle channel on
  sta $4008
  lda #$A9        ;$A9 is a Mi in NTSC mode
  sta $400A
  lda #$00
  sta $400B
  JSR Start_fake_loop_half
  RTS
Sound4:
  lda #%00000111  ;enable Sq1, Sq2 and Tri channels
  sta $4015
  ;Square 1
  lda #%00111000  ;Duty 00, Volume 8 (half volume)
  sta $4000
  lda #$8E        ;$8E is a Sol in NTSC mode
  sta $4002       ;low 8 bits of period
  lda #$00
  sta $4003       ;high 3 bits of period
  ;Square 2
  lda #%01110110  ;Duty 01, Volume 6
  sta $4004
  lda #$E2        ;$E2 is an Si in NTSC mode
  sta $4006
  lda #$00
  sta $4007
  ;Triangle
  lda #%10000001  ;Triangle channel on
  sta $4008
  lda #$BD        ;$BD is a Ré in NTSC mode
  sta $400A
  lda #$00
  sta $400B
  JSR fake_loop
  JSR Start_fake_loop
  RTS

Start_fake_loop:      ; novo loop sem usar o regs Y
  ldx #$00
  STX contadorloop
Call_fake_loop:
  JSR set_loop_fake
  ldx contadorloop
  INX
  STX contadorloop
  CPX #$FF
  BNE Call_fake_loop
  JSR mute_all_channels
  RTS
set_loop_fake:
  ldx #$00
loop_fake:
  INX
  CPX #$FF
  BNE loop_fake
  RTS

Start_fake_loop_half:      ; novo loop sem usar o regs Y
  ldx #$00
  STX contadorloop
Call_fake_loop_half:
  JSR set_loop_fake_half
  ldx contadorloop
  INX
  STX contadorloop
  CPX #$78
  BNE Call_fake_loop_half
  JSR mute_all_channels
  RTS
set_loop_fake_half:
  ldx #$00
loop_fake_half:
  INX
  CPX #$FF
  BNE loop_fake_half
  RTS

Start_fake_loop_30p:      ; novo loop sem usar o regs Y
  ldx #$00
  STX contadorloop
Call_fake_loop_30p:
  JSR set_loop_fake_30p
  ldx contadorloop
  INX
  STX contadorloop
  CPX #$32
  BNE Call_fake_loop_30p
  JSR mute_all_channels
  RTS
set_loop_fake_30p:
  ldx #$00
loop_fake_30p:
  INX
  CPX #$FF
  BNE loop_fake_30p
  RTS

fake_loop:      ; novo loop sem usar o regs Y
  ldx #$00
  STX contadorloop
Ca_fake_loop:
  JSR s_loop_fake
  ldx contadorloop
  INX
  STX contadorloop
  CPX #$FF
  BNE Ca_fake_loop
  RTS
s_loop_fake:
  ldx #$00
lo_fake:
  INX
  CPX #$FF
  BNE lo_fake
  RTS

mute_all_channels:
  lda #%11111000  ;desable Sq1, Sq2 and Tri channels
  sta $4015
  RTS

  .org $E000
palette:
  .db $22,$29,$1A,$0F,  $22,$36,$17,$0F,  $22,$30,$21,$0F,  $22,$27,$17,$0F   ;;background palette
  .db $22,$1C,$15,$14,  $22,$02,$38,$3C,  $22,$1C,$15,$14,  $22,$02,$38,$3C   ;;sprite palette

sprites:
     ;vert tile attr horiz
  .db $80, $32, $00, $80   ;sprite 0
  .db $80, $33, $00, $88   ;sprite 1
  .db $88, $34, $00, $80   ;sprite 2
  .db $88, $35, $00, $88   ;sprite 3

;----------------------------------------------------------------
; interrupt vectors
;----------------------------------------------------------------

  .org $FFFA     ;first of the three vectors starts here
  .dw NMI        ;when an NMI happens (once per frame if enabled) the
                   ;processor will jump to the label NMI:
  .dw RESET      ;when the processor first turns on or is reset, it will jump
                   ;to the label RESET:
  .dw 0          ;external interrupt IRQ is not used in this tutorial

;----------------------------------------------------------------
; CHR-ROM bank
;----------------------------------------------------------------

  .incbin "mario.chr"   ;includes 8KB graphics file from SMB1
