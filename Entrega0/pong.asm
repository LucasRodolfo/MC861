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
  TOPWALL        = $10
  TOPWALLADJUST  = $18
  BOTTOMWALL     = $D8
  LEFTWALL       = $04
  PADDLE1X       = $18  ; horizontal position for paddles
  PADDLE1XADJUST = $20
  PADDLE2X       = $E0
  PADDLE2XADJUST = $D8

;----------------------------------------------------------------
; variables
;----------------------------------------------------------------

  .enum $0000
  gamestate     .dsb 1
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
  paddle1ybotadjust   .dsb 1
  paddle2ytop   .dsb 1  ; player 2 paddle bottom vertical position
  paddle2ybot   .dsb 1
  paddle2ybotadjust   .dsb 1
  buttons1      .dsb 1  ; player 1 gamepad buttons, one bit per button
  buttons2      .dsb 1  ; player 2 gamepad buttons, one bit per button
  scoreOnes     .dsb 1  ; byte for each digit in the decimal score
  scoreTens     .dsb 1
  scoreHundreds .dsb 1
  scorePlayer1  .dsb 1
  scorePlayer2  .dsb 1
  contadorloop  .dsb 1  ; variavel para loop
  waitNextRound .dsb 1
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

LoadBackground:
  LDA $2002             ; read PPU status to reset the high/low latch
  LDA #$20
  STA $2006             ; write the high byte of $2000 address
  LDA #$00
  STA $2006             ; write the low byte of $2000 address
  LDX #$00              ; start out at 0
LoadBackgroundLoop:
  LDA background, x     ; load data from address (background + the value in x)
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$A0              ; Compare X to hex $80, decimal 128 - copying 128 bytes
  BNE LoadBackgroundLoop  ; Branch to LoadBackgroundLoop if compare was Not Equal to zero
                        ; if compare was equal to 128, keep going down

LoadBackground5To9:
  LDX #$00
LoadBackgroundLoop5To9:
  LDA background5To9, x
  STA $2007
  INX
  CPX #$A0
  BNE LoadBackgroundLoop5To9

LoadBackground10To14:
  LDX #$00
LoadBackgroundLoop10To14:
  LDA background10To14, x
  STA $2007
  INX
  CPX #$A0
  BNE LoadBackgroundLoop10To14

LoadBackground15To19:
  LDX #$00
LoadBackgroundLoop15To19:
  LDA background15To19, x
  STA $2007
  INX
  CPX #$A0
  BNE LoadBackgroundLoop15To19

LoadBackground20To24:
  LDX #$00
LoadBackgroundLoop20To24:
  LDA background20To24, x
  STA $2007
  INX
  CPX #$A0
  BNE LoadBackgroundLoop20To24

LoadBackground25To29:
  LDX #$00
LoadBackgroundLoop25To29:
  LDA background25To29, x
  STA $2007
  INX
  CPX #$A0
  BNE LoadBackgroundLoop25To29

LoadAttribute:
  LDA $2002             ; read PPU status to reset the high/low latch
  LDA #$23
  STA $2006             ; write the high byte of $23C0 address
  LDA #$C0
  STA $2006             ; write the low byte of $23C0 address
  LDX #$00              ; start out at 0
LoadAttributeLoop:
  LDA attribute, x      ; load data from address (attribute + the value in x)
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$40              ; Compare X to hex $08, decimal 8 - copying 8 bytes
  BNE LoadAttributeLoop  ; Branch to LoadAttributeLoop if compare was Not Equal to zero
                        ; if compare was equal to 128, keep going down

;;;Set some initial ball stats
InitialValues:
  LDA #$01
  STA balldown
  STA ballright
  LDA #$00
  STA ballup
  STA ballleft
  STA waitNextRound
  LDA #$18
  STA bally
  LDA #$70
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy

  LDA #$64
  STA paddle1ybot
  STA paddle2ybot
  SBC #$08
  STA paddle1ybotadjust
  STA paddle2ybotadjust
  LDA #$84
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

WaitingNextRound:
  LDA waitNextRound
  CMP #$00
  BNE GameEngineDone

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
  LDA #$00
  STA balldown
  STA ballright
  STA ballup
  STA ballleft
  LDA #$01
  STA waitNextRound
  LDX scorePlayer1
  INX
  TXA
  STA scorePlayer1
  jsr IncrementScore1
  JSR fake_loop
  JSR fake_loop
  JSR fake_loop

  LDA #$01
  STA balldown
  STA ballright
  LDA #$00
  STA ballup
  STA ballleft
  LDA #$18
  STA bally
  LDA #$78
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy
  LDA #$64
  STA paddle1ybot
  STA paddle2ybot
  SBC #$08
  STA paddle1ybotadjust
  STA paddle2ybotadjust
  LDA #$84
  STA paddle1ytop
  STA paddle2ytop
  LDA #$00
  STA waitNextRound

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
  ;;in real game, give point to player 2, reset ball
  LDA #$00
  STA balldown
  STA ballright
  STA ballup
  STA ballleft
  LDA #$01
  STA waitNextRound
  LDX scorePlayer2
  INX
  TXA
  STA scorePlayer2
  jsr IncrementScore2
  JSR fake_loop
  JSR fake_loop
  JSR fake_loop

  LDA #$01
  STA ballup
  STA ballleft
  LDA #$00
  STA balldown
  STA ballright
  LDA #$18
  STA bally
  LDA #$78
  STA ballx
  LDA #$02
  STA ballspeedx
  STA ballspeedy
  STA paddlespeedy
  LDA #$64
  STA paddle1ybot
  STA paddle2ybot
  SBC #$08
  STA paddle1ybotadjust
  STA paddle2ybotadjust
  LDA #$84
  STA paddle1ytop
  STA paddle2ytop
  LDA #$00
  STA waitNextRound
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
  STA ballup
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
  STA ballup
MoveBallDownDone:

MovePaddle1Up:
  LDA buttons1
  AND #%00001000
  TAX
  CPX #$00
  BEQ MovePaddle1UpDone
  LDA paddle1ybot
  CMP #TOPWALLADJUST
  BCC MovePaddle1UpDone
  LDA paddle1ybot
  SBC paddlespeedy
  STA paddle1ybot
  SBC #$08
  STA paddle1ybotadjust
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
  CMP #TOPWALLADJUST
  BCC MovePaddle2UpDone
  LDA paddle2ybot
  SBC paddlespeedy
  STA paddle2ybot
  SBC #$08
  STA paddle2ybotadjust
  LDA paddle2ytop
  SBC paddlespeedy
  STA paddle2ytop
MovePaddle2UpDone:

MovePaddle1Down:
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
  SBC #$08
  STA paddle1ybotadjust
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
  SBC #$08
  STA paddle2ybotadjust
  LDA paddle2ytop
  CLC
  ADC paddlespeedy
  STA paddle2ytop
MovePaddle2DownDone:

CheckPaddleCollision:
Paddle1Collision:
  LDA ballx
  CMP #PADDLE1XADJUST
  BCS Paddle1CollisionDone
  LDA bally
  CMP paddle1ybotadjust
  BCC Paddle1YColissionBot
  LDA bally
  CMP paddle1ytop
  BCS Paddle1YColissionTop
  LDA #$01
  STA ballright
  LDA #$00
  STA ballleft
  JSR Paddle_sound
  LDX ballspeedx
  INX
  TXA
  STA ballspeedx
  LDX ballspeedy
  INX
  TXA
  STA ballspeedy
  JMP Paddle1CollisionDone
Paddle1YColissionBot:
  LDA paddle1ybotadjust
  SBC #$02
  CMP bally
  BCS Paddle1CollisionDone
  LDA #$00
  STA balldown
  LDA #$01
  STA ballup
  JMP Paddle1CollisionDone
Paddle1YColissionTop:
  LDA paddle1ytop
  CLC
  ADC #$02
  CMP bally
  BCC Paddle1CollisionDone
  LDA #$01
  STA balldown
  LDA #$00
  STA ballup
  JMP Paddle1CollisionDone
Paddle1CollisionDone:
Paddle2Collision:
  LDA ballx
  CMP #PADDLE2XADJUST
  BCC Paddle2CollisionDone
  LDA bally
  CMP paddle2ybotadjust
  BCC Paddle2YColissionBot
  LDA bally
  CMP paddle2ytop
  BCS Paddle2YColissionTop
  LDA #$00
  STA ballright
  LDA #$01
  STA ballleft
  JSR Paddle_sound
  JMP Paddle2CollisionDone
Paddle2YColissionBot:
  LDA paddle2ybotadjust
  SBC #$02
  CMP bally
  BCS Paddle2CollisionDone
  LDA #$00
  STA balldown
  LDA #$01
  STA ballup
  JMP Paddle2CollisionDone
Paddle2YColissionTop:
  LDA paddle2ytop
  CLC
  ADC #$02
  CMP bally
  BCC Paddle2CollisionDone
  LDA #$01
  STA balldown
  LDA #$00
  STA ballup
  JMP Paddle2CollisionDone
Paddle2CollisionDone:
CheckPaddleCollisionDone:

  JMP GameEngineDone

UpdateSprites:
  LDA bally  ;;update all ball sprite info
  STA $0200
  LDA #$75
  STA $0201
  LDA #$02
  STA $0202
  LDA ballx
  STA $0203
DrawPaddle1:
  LDX paddle1ybot
  LDY #$00
DrawPaddle1Loop:
  TXA
  STA #$0204, y
  INY
  LDA #$59
  STA $0204, y
  INY
  LDA #$01
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
  LDA #$59
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
  LDX #$00

DrawPlayerOneString:
  LDA playerOneString, x     ; load data from address (background + the value in x)
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$05              ; Compare X to hex $80, decimal 128 - copying 128 bytes
  BNE DrawPlayerOneString
  LDA scorePlayer1      ; last digit
  STA $2007
  LDX #$00

DrawPlaceholder:
  LDA placeholder, x     ; load data from address (background + the value in x)
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$13              ; Compare X to hex $80, decimal 128 - copying 128 bytes
  BNE DrawPlaceholder

  LDX #$00
DrawPlayerTwoString:
  LDA playerTwoString, x     ; load data from address (background + the value in x)
  STA $2007             ; write to PPU
  INX                   ; X = X + 1
  CPX #$06              ; Compare X to hex $80, decimal 128 - copying 128 bytes
  BNE DrawPlayerTwoString

DrawScore2:
  LDA scorePlayer2  ; get first digit
  STA $2007          ; draw to background
  RTS

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

IncrementScore2:
  LDA scorePlayer2      ; load the lowest digit of the number
  CMP #$05
  BEQ Play_winners
  JSR Score_sound
  RTS


IncrementScore1:
  LDA scorePlayer1      ; load the lowest digit of the number
  CMP #$05
  BEQ Play_winners
  JSR Score_sound
  RTS


Play_winners:
  JSR Play_winnersound
  LDA #$02
  STA gamestate
  RTS

Paddle_sound:
  lda #%00000100 ;enable Triangle channel
  sta $4015
  lda #%00000001 ;disable counters, non-zero Value turns channel on
  sta $4008
  lda #$42   ;a period of $042 plays a G# in NTSC mode.
  sta $400A
  lda #%00011000
  sta $400B
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
  .db $22,$30,$1A,$0F,  $22,$30,$27,$17,  $2A,$30,$2A,$2A,  $30,$30,$30,$30   ;;background palette

  .db $22,$1C,$15,$14,  $22,$1C,$15,$14,  $29,$2A,$19,$3A,  $22,$30,$27,$17   ;;sprite palette

sprites:
     ;vert tile attr horiz
  .db $80, $31, $00, $80   ;sprite 0
  .db $80, $31, $00, $88   ;sprite 1
  .db $88, $31, $00, $80   ;sprite 2
  .db $88, $31, $00, $88   ;sprite 3

playerOneString:
  ;    L    E    F    T
  .db $15, $0E, $0F, $1D, $24

placeholder:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
  .db $24,$24, $24

playerTwoString:
  ;   R     I    G    H    T
  .db $1B, $12, $10, $11, $1D, $24

background:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;row 1
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;row 2
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

  .db $25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25  ;;row 3
  .db $25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25  ;;some brick tops

  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 4
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;brick bottoms

  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 5
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

background5To9:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 5
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 6
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 7
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 8
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25 ;;row 9
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

background10To14:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 10
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 11
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 12
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 13
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 14
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

background15To19:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25 ;;row 15
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 16
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 17
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 18
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 19
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

background20To24:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 20
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25 ;;row 21
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 25
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25 ;;row 23
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 24
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;all sky

background25To29:
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 25
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
  ;;all sky

  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$25  ;;row 26
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
  ;;all sky

  .db $25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25  ;;row 27
  .db $25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25,$25
  ;;all sky

  .db $47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47  ;;row 28
  .db $47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47,$47
  ;;all sky

  .db $47,$47,$47,$47,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24  ;;row 29
  .db $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
  ;;all sky

attribute:
  ;;row 1
  .db %10101010, %00000010, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 2
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 3
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 4
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 5
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 6
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 7
  .db %10101010, %01010101, %01010000, %11111111, %01010101, %01010101, %01010101, %01010101

  ;;row 8
  .db %01010101, %01010101, %01010101, %01010101, %01010101, %01010101, %01010101, %01010101

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

  .incbin "sprites.chr"   ;includes 8KB graphics file from SMB1
