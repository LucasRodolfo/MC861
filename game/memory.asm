;  __  __                  __       _       
; |  \/  |                /_/      (_)      
; | \  / | ___ _ __ ___   ___  _ __ _  __ _ 
; | |\/| |/ _ \ '_ ` _ \ / _ \| '__| |/ _` |
; | |  | |  __/ | | | | | (_) | |  | | (_| |
; |_|  |_|\___|_| |_| |_|\___/|_|  |_|\__,_|
;
; Change direction: W A S D
; Select card: <space>

define appleL         $00 ; screen location of apple, low byte
define appleH         $01 ; screen location of apple, high byte

; ASCII values of keys controlling the game
define ASCII_w      $77
define ASCII_a      $61
define ASCII_s      $73
define ASCII_d      $64
define ASCII_spc    $20

; Card definitions
define card_rows    $04
define card_cols    $04
define card_width   $04
define card_height  $04
define card_color   $0f
define card_color_s $01
define card_pos     $0200

; System variables
define sys_random   $fe
define sys_last_key $ff


; Cards
cards:  .DB $02, 02, $05, $05, $06, $06, $07, $07

    jmp init

init:
    jsr init_cards

    jsr loop
    rts


init_cards:
    ; TODO
    ; TODO: sort cards array: http://www.6502.org/source/sorting/bubble8.htm
    jsr init_card
    rts


init_card:
    ; TODO
    
    ldx #0
    ldy cards,x

    lda #0
    tax
    tya
    sta card_pos,x

    txa
    tax
    inx
    tya
    sta card_pos,x

    txa
    adc #$1f
    tax
    tya
    sta card_pos,x

    txa
    tax
    inx
    tya
    sta card_pos,x

    rts


loop:
    ; Select first card
    jsr draw
    jsr read_key

    ; Select second card
    jsr draw
    jsr read_key

    jsr compare
    ; TODO: read `compare` result
    ; TODO: sleep if they don't match

    jsr end_game

draw:
    ; TODO
    rts


read_keys:
  lda sys_last_key

  cmp #ASCII_w
  beq handle_up_key

  cmp #ASCII_d
  beq handle_right_key

  cmp #ASCII_s
  beq handle_down_key

  cmp #ASCII_a
  beq handle_left_key

  cmp #ASCII_spc
  beq handle_space_key

  rts


handle_up_key:
    ; TODO
    rts


handle_right_key:
    ; TODO
    rts


handle_down_key:
    ; TODO
    rts


handle_left_key:
    ; TODO
    rts


handle_space_key:
    ; TODO
    rts


illegal_move:
    rts


illegal_select:
    rts


select_card:
    ; TODO
    rts

end_game: