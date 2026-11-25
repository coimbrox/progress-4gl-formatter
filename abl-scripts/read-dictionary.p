/*------------------------------------------------------------------------
  OpenEdge ABL Read Dictionary Structure Helper
  Parameters passed via SESSION:PARAMETER separated by "|":
    1: dbListCsv  (comma-separated logical DB names, or empty = all connected)
    2: outputFile (path to write JSON dictionary cache)
------------------------------------------------------------------------*/
DEFINE VARIABLE cParam      AS CHARACTER NO-UNDO.
DEFINE VARIABLE cDbList     AS CHARACTER NO-UNDO.
DEFINE VARIABLE cOutFile    AS CHARACTER NO-UNDO.
DEFINE VARIABLE iDb         AS INTEGER   NO-UNDO.
DEFINE VARIABLE cDbName     AS CHARACTER NO-UNDO.
DEFINE VARIABLE hFileBuf    AS HANDLE    NO-UNDO.
DEFINE VARIABLE hFieldBuf   AS HANDLE    NO-UNDO.
DEFINE VARIABLE hFileQuery  AS HANDLE    NO-UNDO.
DEFINE VARIABLE hFieldQuery AS HANDLE    NO-UNDO.
DEFINE VARIABLE lFirstDb    AS LOGICAL   NO-UNDO INITIAL YES.
DEFINE VARIABLE lFirstTbl   AS LOGICAL   NO-UNDO.
DEFINE VARIABLE lFirstFld   AS LOGICAL   NO-UNDO.

DEFINE STREAM sJson.

FUNCTION escapeJson RETURNS CHARACTER (INPUT pcText AS CHARACTER):
    DEFINE VARIABLE cRes AS CHARACTER NO-UNDO.
    IF pcText = ? THEN RETURN "".
    cRes = REPLACE(pcText, "\", "\\").
    cRes = REPLACE(cRes, '"', '\"').
    cRes = REPLACE(cRes, CHR(10), "\n").
    cRes = REPLACE(cRes, CHR(13), "").
    cRes = REPLACE(cRes, CHR(9), "\t").
    RETURN cRes.
END FUNCTION.

cParam = SESSION:PARAMETER.
IF NUM-ENTRIES(cParam, "|") < 2 THEN QUIT.

cDbList  = ENTRY(1, cParam, "|").
cOutFile = ENTRY(2, cParam, "|").

OUTPUT STREAM sJson TO VALUE(cOutFile) NO-ECHO.
PUT STREAM sJson UNFORMATTED '~{"databases":[' SKIP.

DO iDb = 1 TO NUM-DBS:
    cDbName = LDBNAME(iDb).
    IF cDbList <> "" AND LOOKUP(cDbName, cDbList) = 0 THEN NEXT.

    IF NOT lFirstDb THEN PUT STREAM sJson UNFORMATTED "," SKIP.
    lFirstDb = NO.

    PUT STREAM sJson UNFORMATTED '  ~{"name":"' + escapeJson(cDbName) + '","tables":[' SKIP.
    lFirstTbl = YES.

    CREATE BUFFER hFileBuf FOR TABLE cDbName + "._File" NO-ERROR.
    CREATE BUFFER hFieldBuf FOR TABLE cDbName + "._Field" NO-ERROR.

    IF VALID-HANDLE(hFileBuf) AND VALID-HANDLE(hFieldBuf) THEN DO:
        CREATE QUERY hFileQuery.
        hFileQuery:SET-BUFFERS(hFileBuf).
        hFileQuery:QUERY-PREPARE(
            "FOR EACH " + cDbName + "._File NO-LOCK WHERE _File._Hidden = NO BY _File._File-Name"
        ).
        hFileQuery:QUERY-OPEN().

        REPEAT:
            hFileQuery:GET-NEXT().
            IF hFileQuery:QUERY-OFF-END THEN LEAVE.

            IF NOT lFirstTbl THEN PUT STREAM sJson UNFORMATTED "," SKIP.
            lFirstTbl = NO.

            PUT STREAM sJson UNFORMATTED
                '    ~{"name":"' + escapeJson(STRING(hFileBuf:BUFFER-FIELD("_File-Name"):BUFFER-VALUE)) +
                '","description":"' + escapeJson(STRING(hFileBuf:BUFFER-FIELD("_Desc"):BUFFER-VALUE)) +
                '","fields":['.

            lFirstFld = YES.
            CREATE QUERY hFieldQuery.
            hFieldQuery:SET-BUFFERS(hFieldBuf).
            hFieldQuery:QUERY-PREPARE(
                "FOR EACH " + cDbName + "._Field NO-LOCK WHERE _Field._File-Recid = RECID(" + cDbName + "._File) BY _Field._Order"
            ).
            hFieldQuery:QUERY-OPEN().

            REPEAT:
                hFieldQuery:GET-NEXT().
                IF hFieldQuery:QUERY-OFF-END THEN LEAVE.

                IF NOT lFirstFld THEN PUT STREAM sJson UNFORMATTED ",".
                lFirstFld = NO.

                PUT STREAM sJson UNFORMATTED
                    '~{"name":"' + escapeJson(STRING(hFieldBuf:BUFFER-FIELD("_Field-Name"):BUFFER-VALUE)) +
                    '","dataType":"' + escapeJson(STRING(hFieldBuf:BUFFER-FIELD("_Data-Type"):BUFFER-VALUE)) +
                    '","format":"' + escapeJson(STRING(hFieldBuf:BUFFER-FIELD("_Format"):BUFFER-VALUE)) +
                    '","label":"' + escapeJson(STRING(hFieldBuf:BUFFER-FIELD("_Label"):BUFFER-VALUE)) +
                    '","description":"' + escapeJson(STRING(hFieldBuf:BUFFER-FIELD("_Desc"):BUFFER-VALUE)) +
                    '","extent":' + STRING(INTEGER(hFieldBuf:BUFFER-FIELD("_Extent"):BUFFER-VALUE)) + '~}'.
            END.

            hFieldQuery:QUERY-CLOSE().
            DELETE OBJECT hFieldQuery NO-ERROR.

            PUT STREAM sJson UNFORMATTED ']~}'.
        END.

        hFileQuery:QUERY-CLOSE().
        DELETE OBJECT hFileQuery NO-ERROR.
    END.

    DELETE OBJECT hFileBuf NO-ERROR.
    DELETE OBJECT hFieldBuf NO-ERROR.

    PUT STREAM sJson UNFORMATTED SKIP '  ]~}'.
END.

PUT STREAM sJson UNFORMATTED SKIP ']~}' SKIP.
OUTPUT STREAM sJson CLOSE.
QUIT.
