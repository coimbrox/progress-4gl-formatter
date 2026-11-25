/*------------------------------------------------------------------------
  OpenEdge ABL Compile / Check Syntax Helper
  Parameters passed via SESSION:PARAMETER separated by "|":
    1: mode       ("check" | "compile")
    2: sourceFile (full path to .p/.w/.cls/.i)
    3: saveDir    (target directory for .r and option files)
    4: optionsCsv (comma-separated: XREF,XREF-XML,DEBUG-LIST,PREPROCESS,LISTING,STRING-XREF)
    5: resultFile (path to write structured diagnostics)
------------------------------------------------------------------------*/
DEFINE VARIABLE cParam      AS CHARACTER NO-UNDO.
DEFINE VARIABLE cMode       AS CHARACTER NO-UNDO.
DEFINE VARIABLE cSource     AS CHARACTER NO-UNDO.
DEFINE VARIABLE cSaveDir    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cOptions    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cResultFile AS CHARACTER NO-UNDO.
DEFINE VARIABLE cBaseName   AS CHARACTER NO-UNDO.
DEFINE VARIABLE cXref       AS CHARACTER NO-UNDO.
DEFINE VARIABLE cXrefXml    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cDebugList  AS CHARACTER NO-UNDO.
DEFINE VARIABLE cPreprocess AS CHARACTER NO-UNDO.
DEFINE VARIABLE cListing    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cStrXref    AS CHARACTER NO-UNDO.
DEFINE VARIABLE iErr        AS INTEGER   NO-UNDO.
DEFINE VARIABLE cMsg        AS CHARACTER NO-UNDO.
DEFINE VARIABLE cSeverity   AS CHARACTER NO-UNDO.

DEFINE STREAM sOut.

cParam = SESSION:PARAMETER.
IF NUM-ENTRIES(cParam, "|") < 5 THEN QUIT.

cMode       = ENTRY(1, cParam, "|").
cSource     = ENTRY(2, cParam, "|").
cSaveDir    = ENTRY(3, cParam, "|").
cOptions    = ENTRY(4, cParam, "|").
cResultFile = ENTRY(5, cParam, "|").

cBaseName = REPLACE(cSource, "\", "/").
cBaseName = ENTRY(NUM-ENTRIES(cBaseName, "/"), cBaseName, "/").
IF R-INDEX(cBaseName, ".") > 0 THEN
    cBaseName = SUBSTRING(cBaseName, 1, R-INDEX(cBaseName, ".") - 1).

IF cSaveDir <> "" THEN DO:
    IF LOOKUP("XREF", cOptions) > 0 THEN
        cXref = cSaveDir + "/" + cBaseName + ".xref".
    IF LOOKUP("XREF-XML", cOptions) > 0 THEN
        cXrefXml = cSaveDir + "/" + cBaseName + ".xref.xml".
    IF LOOKUP("DEBUG-LIST", cOptions) > 0 THEN
        cDebugList = cSaveDir + "/" + cBaseName + ".dbg".
    IF LOOKUP("PREPROCESS", cOptions) > 0 THEN
        cPreprocess = cSaveDir + "/" + cBaseName + ".pre".
    IF LOOKUP("LISTING", cOptions) > 0 THEN
        cListing = cSaveDir + "/" + cBaseName + ".lis".
    IF LOOKUP("STRING-XREF", cOptions) > 0 THEN
        cStrXref = cSaveDir + "/" + cBaseName + ".strxref".
END.

IF cMode = "check" THEN DO:
    COMPILE VALUE(cSource) SAVE = NO NO-ERROR.
END.
ELSE DO:
    IF cOptions = "" THEN DO:
        IF cSaveDir <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) NO-ERROR.
        ELSE
            COMPILE VALUE(cSource) SAVE = YES NO-ERROR.
    END.
    ELSE DO:
        IF cXref <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) XREF VALUE(cXref) NO-ERROR.
        ELSE IF cXrefXml <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) XREF-XML VALUE(cXrefXml) NO-ERROR.
        ELSE IF cDebugList <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) DEBUG-LIST VALUE(cDebugList) NO-ERROR.
        ELSE IF cPreprocess <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) PREPROCESS VALUE(cPreprocess) NO-ERROR.
        ELSE IF cListing <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) LISTING VALUE(cListing) NO-ERROR.
        ELSE IF cStrXref <> "" THEN
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) STRING-XREF VALUE(cStrXref) NO-ERROR.
        ELSE
            COMPILE VALUE(cSource) SAVE = YES INTO VALUE(cSaveDir) NO-ERROR.
    END.
END.

OUTPUT STREAM sOut TO VALUE(cResultFile) NO-ECHO.

IF COMPILER:ERROR OR ERROR-STATUS:ERROR THEN DO:
    PUT STREAM sOut UNFORMATTED
        "STATUS|ERROR|" + STRING(COMPILER:ERROR-ROW) + "|" + STRING(COMPILER:ERROR-COLUMN) + "|" + COMPILER:FILE-NAME SKIP.
    cSeverity = "ERROR".
END.
ELSE IF COMPILER:WARNING THEN DO:
    PUT STREAM sOut UNFORMATTED "STATUS|WARNING" SKIP.
    cSeverity = "WARNING".
END.
ELSE DO:
    PUT STREAM sOut UNFORMATTED "STATUS|OK" SKIP.
    cSeverity = "INFO".
END.

DO iErr = 1 TO ERROR-STATUS:NUM-MESSAGES:
    cMsg = REPLACE(ERROR-STATUS:GET-MESSAGE(iErr), CHR(10), " ").
    cMsg = REPLACE(cMsg, CHR(13), " ").
    PUT STREAM sOut UNFORMATTED
        "MSG|" + cSeverity + "|" +
        STRING(ERROR-STATUS:GET-NUMBER(iErr)) + "|" +
        STRING(COMPILER:ERROR-ROW) + "|" +
        STRING(COMPILER:ERROR-COLUMN) + "|" +
        COMPILER:FILE-NAME + "|" +
        cMsg SKIP.
END.

OUTPUT STREAM sOut CLOSE.
QUIT.
