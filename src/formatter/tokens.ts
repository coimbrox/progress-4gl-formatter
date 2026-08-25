export type TokenKind =
    | 'word'          // identifier or keyword (letters/digits/-/_ , e.g. no-lock, cd-prestador)
    | 'string'        // "..." or '...'
    | 'number'        // 123, 123.45, .5
    | 'preprocessor'  // {include.i "arg"} or {&VAR}
    | 'lineComment'   // // ...
    | 'blockComment'  // /* ... */ (may be nested)
    | 'eos'           // statement-terminating period
    | 'punct'         // : , ( ) [ ]
    | 'operator'      // = <> <= >= < > + - * / :: (colon used as label is 'punct')
    | 'newline'       // one blank line marker (see Lexer — collapsed)
    | 'eof';

export interface Token {
    kind: TokenKind;
    text: string;
    /** number of blank source lines immediately before this token (0, 1, 2, ...) */
    blankLinesBefore: number;
    /** true if at least one newline separates this token from the previous one */
    precededByNewline: boolean;
    line: number;
    col: number;
}
