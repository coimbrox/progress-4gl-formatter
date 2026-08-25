import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatSource } from '../index';

/**
 * Real excerpts from Mateus Hahn's code in the sibling `especificos` repo
 * (gp/dep/dees051.p, integraTasy/integraMovimentosCaixa.p), used as the
 * acceptance bar for this formatter's target style — see the
 * "Formatter rewrite project" memory note for why these specific files.
 */

const VALIDA_IMPOSTO_FUNCTION = `function validaImposto returns char (pais-par as char, uf-par as char, imposto-par as char, ds-imposto as char):
  find imposto
    where imposto.cod_pais         = pais-par
      and imposto.cod_unid_federac = uf-par
      and imposto.cod_imposto      = imposto-par
          no-lock no-error.

  if avail imposto
  then return "".

  return "Imposto " + ds-imposto.

end function.`;

const DEF_VAR_BLOCK = `def new shared var cd-unimed-z     like unimed.cd-unimed               no-undo.
def new shared var cd-med-prest-z  like preserv.cd-prestador           no-undo.
def new shared var cd-transacao-z  like tranrevi.cd-transacao          no-undo.
def new shared var cd-retorno      as log                              no-undo.

def var nm-prestador-exec-aux    like preserv.nm-prestador            no-undo.
def var nm-clinica-pag-aux       like preserv.nm-prestador            no-undo.
def var dt-anoref-aux              as int format "9999"               no-undo.
def var nr-perref-aux              as int format "99"                 no-undo.`;

const TEMP_TABLE_BLOCK = `def temp-table tmp-movimentos
  field cd-prestador      like moviproc.cd-prestador
  field nm-prestador      like preserv.nm-prestador
  field dt-anoref         like moviproc.dt-anoref
  field nr-perref         like moviproc.nr-perref
  field cd-clinica-pag    like moviproc.cd-prestador
  field nm-clinica-pag    like preserv.nm-prestador
  field dt-inclusao       like preserv.dt-inclusao
  field cd-contratante    like preserv.cd-contratante.`;

const FOR_EACH_WHERE_BLOCK = `for each movto_tit_acr
    where movto_tit_acr.cod_estab            = tit_acr.cod_estab
      and movto_tit_acr.num_id_tit_acr       = tit_Acr.num_id_tit_acr
      and movto_tit_acr.ind_trans_acr_abrev  = "LIQ"
           no-lock:
  message "ok".
end.`;

const IF_AND_CHAIN = `if   index(cd-grupos-aux, string(b-prestador.cd-grupo-prestador)) = 0
and  index(cd-grupos-aux, string(b-pres-pagto.cd-grupo-prestador)) = 0
then return "".`;

for (const [name, src] of Object.entries({
    VALIDA_IMPOSTO_FUNCTION, DEF_VAR_BLOCK, TEMP_TABLE_BLOCK, FOR_EACH_WHERE_BLOCK, IF_AND_CHAIN,
})) {
    test(`${name}: formats without throwing and is idempotent`, () => {
        const once = formatSource(src);
        const twice = formatSource(once);
        assert.equal(twice, once, 'formatting a second time should be a no-op');
    });
}

test('validaImposto: where/and operators land in the same column', () => {
    const lines = formatSource(VALIDA_IMPOSTO_FUNCTION).split('\n');
    const eqCols = lines
        .filter(l => l.trim().startsWith('where') || l.trim().startsWith('and'))
        .map(l => l.indexOf('='));
    assert.ok(eqCols.length >= 3);
    assert.ok(eqCols.every(c => c === eqCols[0]));
});

test('def var block: name column is aligned within each blank-line-separated group', () => {
    const lines = formatSource(DEF_VAR_BLOCK).split('\n').filter(l => l.trim().length > 0);
    const likeOrAsCol = (l: string) => {
        const m = l.match(/ (like|as) /);
        return m ? m.index : -1;
    };
    const firstGroup = lines.slice(0, 4).map(likeOrAsCol);
    const secondGroup = lines.slice(4, 8).map(likeOrAsCol);
    assert.ok(firstGroup.every(c => c === firstGroup[0]));
    assert.ok(secondGroup.every(c => c === secondGroup[0]));
});

test('temp-table block: field names are aligned before like/as', () => {
    const lines = formatSource(TEMP_TABLE_BLOCK).split('\n').filter(l => l.includes('field'));
    const likeCol = lines.map(l => l.indexOf('like'));
    assert.ok(likeCol.every(c => c === likeCol[0]));
});

test('for each ... where block opens a block (colon) and its body is indented', () => {
    const lines = formatSource(FOR_EACH_WHERE_BLOCK).split('\n');
    const messageLine = lines.find(l => l.includes('message'))!;
    assert.ok(messageLine.startsWith('  '));
});

test('if/and chain: comparison operators align across if and and', () => {
    const lines = formatSource(IF_AND_CHAIN).split('\n');
    const ifLine = lines.find(l => l.trim().startsWith('if'))!;
    const andLine = lines.find(l => l.trim().startsWith('and'))!;
    assert.equal(ifLine.indexOf('='), andLine.indexOf('='));
});
