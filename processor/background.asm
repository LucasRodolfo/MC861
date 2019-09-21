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

;----------------------------------------------------------------
; variables
;----------------------------------------------------------------

  .enum $0000
  .ende
  .base $10000-($4000)

RESET:
NMI:
teste:
  TAX
  TAX
  JSR teste3
teste3:
  TAX
  TAX
  TAX
  TAX
  BVS final
teste2:
  TAX
  TAX
  RTS
final:

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
