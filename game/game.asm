; NES Game Development Tutorial
;
; Author: Jonathan Moody
; Github: https://github.com/jonmoody

  .inesprg 1    ; Defines the number of 16kb PRG banks
  .ineschr 1    ; Defines the number of 8kb CHR banks
  .inesmap 0    ; Defines the NES mapper
  .inesmir 1    ; Defines VRAM mirroring of banks

  .rsset $0000
pointerBackgroundLowByte  .rs 1
pointerBackgroundHighByte .rs 1

shipTile1Y = $0300
shipTile2Y = $0304
shipTile3Y = $0308
shipTile4Y = $030C
shipTile5Y = $0310
shipTile6Y = $0314

shipTile1X = $0303
shipTile2X = $0307
shipTile3X = $030B
shipTile4X = $030F
shipTile5X = $0313
shipTile6X = $0317

player1Controller = $4016

  .bank 0
  .org $C000

RESET:
  JSR LoadBackground
  JSR LoadPalettes
  JSR LoadAttributes
  JSR LoadSprites

  LDA #%10000000   ; Enable NMI, sprites and background on table 0
  STA $2000
  LDA #%00011110   ; Enable sprites, enable backgrounds
  STA $2001
  LDA #$00         ; No background scrolling
  STA $2006
  STA $2006
  STA $2005
  STA $2005

InfiniteLoop:
  JMP InfiniteLoop

LoadBackground:
  LDA $2002
  LDA #$20
  STA $2006
  LDA #$00
  STA $2006

  LDA #LOW(background)
  STA pointerBackgroundLowByte
  LDA #HIGH(background)
  STA pointerBackgroundHighByte

  LDX #$00
  LDY #$00
.Loop:
  LDA [pointerBackgroundLowByte], y
  STA $2007

  INY
  CPY #$00
  BNE .Loop

  INC pointerBackgroundHighByte
  INX
  CPX #$04
  BNE .Loop
  RTS

LoadPalettes:
  LDA $2002
  LDA #$3F
  STA $2006
  LDA #$00
  STA $2006

  LDX #$00
.Loop:
  LDA palettes, x
  STA $2007
  INX
  CPX #$20
  BNE .Loop
  RTS

LoadAttributes:
  LDA $2002
  LDA #$23
  STA $2006
  LDA #$C0
  STA $2006
  LDX #$00
.Loop:
  LDA attributes, x
  STA $2007
  INX
  CPX #$40
  BNE .Loop
  RTS

LoadSprites:
  LDX #$00
.Loop:
  LDA sprites, x
  STA $0300, x
  INX
  CPX #$18
  BNE .Loop
  RTS

ReadPlayerOneControls:
  LDA #$01
  STA player1Controller
  LDA #$00
  STA player1Controller

ReadA:
  LDA player1Controller       ; Player 1 - A

ReadB:
  LDA player1Controller       ; Player 1 - B

ReadSelect:
  LDA player1Controller       ; Player 1 - Select

ReadStart:
  LDA player1Controller       ; Player 1 - Start
  AND #%00000001
  BEQ NoReadStart

  JSR PlaySoundStart
  JMP EndReadStart
NoReadStart:
  JSR MuteSoundStart
EndReadStart:

ReadUp:
  LDA player1Controller       ; Player 1 - Up
  AND #%00000001
  BEQ NoReadUp

  LDA shipTile1Y
  SEC
  SBC #$02
  STA shipTile1Y
  STA shipTile2Y
  STA shipTile3Y

  LDA shipTile4Y
  SEC
  SBC #$02
  STA shipTile4Y
  STA shipTile5Y
  STA shipTile6Y

  JSR PlaySoundUp
  JMP EndReadUp
NoReadUp:
  JSR MuteSoundUp
EndReadUp:

ReadDown:
  LDA player1Controller       ; Player 1 - Down
  AND #%00000001
  BEQ EndReadDown

  JSR MoveDown
EndReadDown:

ReadLeft:
  LDA player1Controller       ; Player 1 - Left
  AND #%00000001
  BEQ EndReadLeft

  LDA shipTile1X
  SEC
  SBC #$01
  STA shipTile1X
  STA shipTile4X

  LDA shipTile2X
  SEC
  SBC #$01
  STA shipTile2X
  STA shipTile5X

  LDA shipTile3X
  SEC
  SBC #$01
  STA shipTile3X
  STA shipTile6X
EndReadLeft:

ReadRight:
  LDA player1Controller       ; Player 1 - Right
  AND #%00000001
  BEQ EndReadRight

  LDA shipTile1X
  CLC
  ADC #$01
  STA shipTile1X
  STA shipTile4X

  LDA shipTile2X
  CLC
  ADC #$01
  STA shipTile2X
  STA shipTile5X

  LDA shipTile3X
  CLC
  ADC #$01
  STA shipTile3X
  STA shipTile6X
EndReadRight:

  RTS

PlaySoundUp:
  LDA $4015
  ORA #%00000001
  STA $4015 ;enable square 1

  LDA #%10111111 ;Duty 10, Volume F
  STA $4000

  LDA #$C9    ;0C9 is a C# in NTSC mode
  STA $4002
  LDA #$01
  STA $4003

  RTS

PlaySoundStart:
  LDA $4015
  ORA #%00000010
  STA $4015 ;enable square 2

  LDA #%10111111 ;Duty 10, Volume F
  STA $4004

  LDA #$B7    ;0C9 is a C# in NTSC mode
  STA $4006
  LDA #$02
  STA $4007

  RTS

MuteSoundUp:
  LDA $4015
  AND #%11111110
  STA $4015

  RTS

MuteSoundStart:
  LDA $4015
  AND #%11111101
  STA $4015

  RTS

MoveDown:
  LDA shipTile1Y
  CLC
  ADC #$01
  STA shipTile1Y
  STA shipTile2Y
  STA shipTile3Y

  LDA shipTile4Y
  CLC
  ADC #$01
  STA shipTile4Y
  STA shipTile5Y
  STA shipTile6Y

  RTS

NMI:
  LDA #$00
  STA $2003
  LDA #$03
  STA $4014

  JSR ReadPlayerOneControls
  JSR MoveDown

  RTI

  .bank 1
  .org $E000

background:
  .include "graphics/background.asm"

palettes:
  .include "graphics/palettes.asm"

attributes:
  .include "graphics/attributes.asm"

sprites:
  .include "graphics/sprites.asm"

  .org $FFFA
  .dw NMI
  .dw RESET
  .dw 0

  .bank 2
  .org $0000
  .incbin "graphics.chr"
