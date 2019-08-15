;  __  __                  __       _       
; |  \/  |                /_/      (_)      
; | \  / | ___ _ __ ___   ___  _ __ _  __ _ 
; | |\/| |/ _ \ '_ ` _ \ / _ \| '__| |/ _` |
; | |  | |  __/ | | | | | (_) | |  | | (_| |
; |_|  |_|\___|_| |_| |_|\___/|_|  |_|\__,_|
;
; Change direction: W A S D
; Select card: <space>

; Memory map
define cards   $00  ; Cards array
define appleL  $70  ; Screen location of apple, low byte
define appleH  $71  ; Screen location of apple, high byte

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

; Other constants
define nl   $1f

; System variables
define sys_random   $fe
define sys_last_key $ff

; Colors
define cl_black        $0
define cl_white        $1
define cl_red          $2
define cl_cyan         $3
define cl_purple       $4
define cl_green        $5
define cl_blue         $6
define cl_yellow       $7
define cl_orange       $8
define cl_brown        $9
define cl_light_red    $a
define cl_dark_grey    $b
define cl_grey         $c
define cl_light_green  $d
define cl_light_blue   $e
define cl_light_grey   $f

init:
    jsr init_cards

    jsr loop
    rts


init_cards:
    ldy #0

    lda #cl_red
    jsr init_card_pair

    lda #cl_green
    jsr init_card_pair

    lda #cl_blue
    jsr init_card_pair

    lda #cl_yellow
    jsr init_card_pair

    ; TODO: randomly sort cards array: http://www.6502.org/source/sorting/bubble8.htm

    rts


init_card_pair:
    sta (cards),y
    iny

    sta (cards),y
    iny

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
    jsr draw_card
    rts


draw_card:
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
    adc #nl
    tax
    tya
    sta card_pos,x

    txa
    tax
    inx
    tya
    sta card_pos,x

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