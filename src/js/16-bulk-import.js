/* ═════════════ bulk import: template, upload, tidy, review, create ═════════════ */
/* No libraries: a small zip + xlsx writer/reader, CSV parser, matching rules, optional
   LanguageTool spelling and optional AI tidy (through the notify edge function). */

/* ── zip (store for writing; store + deflate for reading) ── */
const ZIP = (() => {
  const T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const te = new TextEncoder(), td = new TextDecoder();
  function write(files) {
    const parts = [], central = []; let off = 0;
    for (const [name, text] of files) {
      const nb = te.encode(name), data = typeof text === 'string' ? te.encode(text) : text, c = crc(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, c, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const csize = central.reduce((n, x) => n + x.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  async function inflate(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t open .xlsx files. Save the sheet as CSV and upload that instead.');
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function read(buf) {
    const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This file isn’t a spreadsheet Ovrto can read.');
    const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = {};
    for (let k = 0; k < count; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const method = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = td.decode(b.subarray(p + 46, p + 46 + nl));
      const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true); const start = lo + 30 + lnl + lxl;
      out[name] = { method, raw: b.subarray(start, start + csz) };
      p += 46 + nl + xl + cl;
    }
    return { has: n => !!out[n], async text(n) { const f = out[n]; if (!f) return null; const d = f.method === 8 ? await inflate(f.raw) : f.raw; return td.decode(d); } };
  }
  return { write, read };
})();

/* ── xlsx writer: inline strings, a few styles, list dropdowns with tips ── */
const XL = (() => {
  const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  // styles: 0 normal · 1 header ink · 2 header required (cobalt) · 3 example (grey italic) · 4 title · 5 heading · 6 body wrap · 7 cell wrap
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="10"/><color rgb="FF6B6B72"/><name val="Arial"/></font><font><b/><sz val="18"/><color rgb="FF0D0D0F"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF2A44B0"/><name val="Arial"/></font><font><sz val="11"/><color rgb="FF2B2B30"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D0D0F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2A44B0"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFE2E2DE"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="8"><xf fontId="0"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf fontId="1" fillId="3" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf fontId="2" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="3" applyFont="1"/><xf fontId="4" applyFont="1"/><xf fontId="5" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
</styleSheet>`;
  function sheet({ rows, widths = [], freeze, validations = [], heights = {}, grid = true, emptyRows = 0, emptyStyle = 0, cols = 0, rtl = false }) {
    const out = [];
    rows.forEach((r, i) => {
      const cells = r.map((c, j) => { if (c == null) return ''; const o = typeof c === 'object' ? c : { v: c }; if (o.v == null || o.v === '') return o.s ? `<c r="${col(j)}${i + 1}" s="${o.s}"/>` : ''; return typeof o.v === 'number' ? `<c r="${col(j)}${i + 1}" s="${o.s || 0}"><v>${o.v}</v></c>` : `<c r="${col(j)}${i + 1}" s="${o.s || 0}" t="inlineStr"><is><t xml:space="preserve">${x(o.v)}</t></is></c>`; }).join('');
      out.push(`<row r="${i + 1}"${heights[i] ? ` ht="${heights[i]}" customHeight="1"` : ''}>${cells}</row>`);
    });
    for (let k = 0; k < emptyRows; k++) { const r = rows.length + k + 1; out.push(`<row r="${r}">${Array.from({ length: cols }, (_, j) => `<c r="${col(j)}${r}" s="${emptyStyle}"/>`).join('')}</row>`); }
    const pane = freeze ? `<pane xSplit="${freeze[0]}" ySplit="${freeze[1]}" topLeftCell="${col(freeze[0])}${freeze[1] + 1}" activePane="bottomRight" state="frozen"/>` : '';
    const dv = validations.length ? `<dataValidations count="${validations.length}">${validations.map(v => `<dataValidation${v.list ? ' type="list"' : ''} allowBlank="1" showInputMessage="1" showErrorMessage="${v.strict ? 1 : 0}" errorStyle="information" promptTitle="${x(v.title || '').slice(0, 32)}" prompt="${x(v.prompt || '').slice(0, 255)}" sqref="${v.ref}">${v.list ? `<formula1>${x(v.list)}</formula1>` : ''}</dataValidation>`).join('')}</dataValidations>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${grid ? '' : ' showGridLines="0"'}${rtl ? ' rightToLeft="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}<sheetData>${out.join('')}</sheetData>${dv}</worksheet>`;
  }
  function book(sheets, active = 0) {
    const files = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${x(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', styles],
      ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet(s)]),
    ];
    return ZIP.write(files);
  }
  return { book, col };
})();

/* ── xlsx reader → array of rows (array of cell values) for the best sheet ── */
async function readXlsx(buf) {
  const z = await ZIP.read(buf);
  const P = s => new DOMParser().parseFromString(s || '<x/>', 'application/xml');
  const kids = (n, tag) => Array.from(n.getElementsByTagName('*')).filter(e => e.localName === tag);
  const shared = []; const ss = await z.text('xl/sharedStrings.xml');
  if (ss) for (const si of kids(P(ss), 'si')) shared.push(kids(si, 't').map(t => t.textContent).join(''));
  // which cell styles are dates
  const dateStyle = new Set(); const st = await z.text('xl/styles.xml');
  if (st) {
    const d = P(st); const custom = {}; for (const nf of kids(d, 'numFmt')) custom[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode') || '';
    const xfsParent = kids(d, 'cellXfs')[0];
    if (xfsParent) kids(xfsParent, 'xf').forEach((xf, i) => { const id = +xf.getAttribute('numFmtId') || 0; const code = custom[id] || ''; if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /(^|[^"\\])[dmy]{1,4}/i.test(code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''))) dateStyle.add(i); });
  }
  // sheets, in order; prefer one called Tasks
  const wb = P(await z.text('xl/workbook.xml')); const rels = P(await z.text('xl/_rels/workbook.xml.rels'));
  const target = {}; for (const r of kids(rels, 'Relationship')) target[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = kids(wb, 'sheet').map(s => { const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'); let t = target[rid] || ''; t = t.replace(/^\//, ''); if (!t.startsWith('xl/')) t = 'xl/' + t; return { name: s.getAttribute('name'), path: t }; });
  const parse = async path => {
    const d = P(await z.text(path)); const rows = [];
    for (const r of kids(d, 'row')) {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1; const row = rows[ri] = rows[ri] || [];
      let auto = 0;
      for (const c of kids(r, 'c')) {
        const ref = c.getAttribute('r'); let ci = auto;
        if (ref) { const m = ref.match(/^([A-Z]+)/); ci = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1; }
        auto = ci + 1;
        const t = c.getAttribute('t'); const v = kids(c, 'v')[0]?.textContent; let val = null;
        if (t === 's') val = shared[+v] ?? '';
        else if (t === 'inlineStr') val = kids(c, 't').map(x => x.textContent).join('');
        else if (t === 'str' || t === 'e') val = v ?? '';
        else if (t === 'b') val = v === '1';
        else if (v != null && v !== '') { const n = +v; val = dateStyle.has(+c.getAttribute('s') || 0) ? { date: n } : n; }
        row[ci] = val;
      }
    }
    return Array.from(rows, r => Array.from(r || [], c => (c === undefined ? null : c)));
  };
  let best = null;
  for (const s of sheets) {
    if (!z.has(s.path)) continue;
    const rows = await parse(s.path); const hi = findHeader(rows);
    const score = (hi >= 0 ? 10 : 0) + (/^tasks?$/i.test(s.name) ? 5 : 0) + (/how to|lists?|instructions?/i.test(s.name) ? -20 : 0);
    if (!best || score > best.score) best = { rows, score, name: s.name };
  }
  return best?.rows || [];
}

/* ── CSV / TSV ── */
function readCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = ['\t', ';', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ── header mapping ── */
const IMP_ALIASES = {
  title: ['title', 'summary', 'subject', 'task', 'name', 'issue', 'tasktitle', 'bugtitle', 'requirement', 'request', 'العنوان', 'المهمة'],
  type: ['type', 'kind', 'issuetype', 'category', 'tasktype', 'النوع'],
  description: ['description', 'details', 'detail', 'notes', 'body', 'desc', 'comment', 'الوصف', 'التفاصيل'],
  priority: ['priority', 'prio', 'urgency', 'severity', 'importance', 'الأولوية'],
  developer: ['developer', 'assignee', 'assignedto', 'assigned', 'owner', 'dev', 'responsible', 'who', 'المطور', 'المسؤول'],
  reviewer: ['reviewer', 'qa', 'tester', 'checker', 'reviewedby', 'المراجع'],
  due: ['duedate', 'due', 'deadline', 'dueon', 'by', 'enddate', 'الموعد', 'التسليم'],
  sprint: ['sprint', 'cycle', 'iteration', 'week'],
  project: ['project', 'epic', 'milestone', 'المشروع'],
  status: ['status', 'state', 'stage', 'الحالة'],
  labels: ['labels', 'tags', 'label', 'tag'],
};
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const keys = (rows[i] || []).map(c => headerKey(c)).filter(Boolean);
    if (keys.some(k => k === 'title') && keys.length >= 1) return i;
  }
  return -1;
}
function headerKey(h) {
  if (h == null || typeof h === 'object') return null;
  const n = norm(String(h).replace(/\*|\(.*?\)/g, ''));
  if (!n) return null;
  for (const [k, list] of Object.entries(IMP_ALIASES)) if (list.includes(n)) return k;
  for (const ty of S.types) for (const s of ty.template || []) if (norm(s) === n) return 'sec:' + s;
  if (['steps', 'stepstoreproduce', 'repro', 'reproduce', 'howtoreproduce'].includes(n)) { const s = imp_sectionNames().find(x => /steps/i.test(x)); if (s) return 'sec:' + s; }
  if (['expectedresult', 'expectedbehaviour', 'expectedbehavior', 'shouldbe'].includes(n)) { const s = imp_sectionNames().find(x => /expected/i.test(x)); if (s) return 'sec:' + s; }
  if (['actualresult', 'actualbehaviour', 'actualbehavior', 'whathappens'].includes(n)) { const s = imp_sectionNames().find(x => /actual/i.test(x)); if (s) return 'sec:' + s; }
  for (const f of S.fields) if (norm(f.name) === n || norm(f.key) === n) return 'f:' + f.id;
  if (['component', 'module', 'components', 'modules'].includes(n)) { const f = fdKey('area') || S.fields.find(f => f.kind === 'multi'); if (f) return 'f:' + f.id; }
  if (['customer', 'account', 'company', 'العميل'].includes(n)) { const f = clientField(); if (f) return 'f:' + f.id; }
  return null;
}
const imp_sectionNames = () => [...new Set(S.types.flatMap(t => t.template || []))];

/* ── matching helpers ── */
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  // optimal string alignment: a swapped pair of letters (veiw → view) counts as one typo
  const d = Array.from({ length: a.length + 1 }, (_, i) => { const r = new Array(b.length + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
const sing = s => s.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
function matchLabel(raw, options, getLabel, extra = {}) {
  const n = norm(raw); if (!n) return null;
  for (const o of options) { const l = norm(getLabel(o)); if (l === n || norm(o.id || '') === n) return { o, how: 'exact' }; }
  for (const [o, words] of extra.syn || []) if (words.includes(n)) return { o, how: 'word' };
  for (const o of options) { const l = norm(getLabel(o)); if (sing(l) === sing(n)) return { o, how: 'plural' }; }
  for (const o of options) { const l = norm(getLabel(o)); if (n.length >= 3 && (l.startsWith(n) || (n.length >= 5 && l.includes(n)))) return { o, how: 'part' }; }
  let best = null; for (const o of options) { const l = norm(getLabel(o)); const d = lev(l, n); const lim = l.length >= 8 ? 2 : l.length >= 4 ? 1 : 0; if (d <= lim && (!best || d < best.d)) best = { o, d }; }
  return best ? { o: best.o, how: 'typo' } : null;
}
function matchPerson(raw) {
  const s = String(raw || '').trim(); if (!s) return null;
  const people = S.members.map(m => ({ id: m.user_id, p: prof(m.user_id) || {} }));
  const em = s.toLowerCase();
  let hit = people.find(x => (x.p.email || '').toLowerCase() === em); if (hit) return hit.id;
  const n = norm(s);
  hit = people.find(x => norm(dname(x.p)) === n); if (hit) return hit.id;
  const words = s.toLowerCase().split(/[\s.]+/).filter(Boolean);
  const cand = people.filter(x => { const parts = dname(x.p).toLowerCase().split(/\s+/); return words.every((w, i) => parts[i] && (parts[i] === w || (w.length <= 2 && parts[i].startsWith(w)) || (i === words.length - 1 && w.length >= 1 && parts[i].startsWith(w)))); });
  if (cand.length === 1) return cand[0].id;
  hit = people.filter(x => norm(first(x.p)) === norm(words[0] || ''));
  if (hit.length === 1) return hit[0].id;
  hit = people.filter(x => (x.p.email || '').toLowerCase().split('@')[0].split(/[._-]/).includes(words[0]));
  if (hit.length === 1) return hit[0].id;
  const fz = people.map(x => ({ x, d: lev(norm(first(x.p)), norm(words[0] || '')) })).filter(o => o.d <= (norm(words[0] || '').length >= 5 ? 2 : 1)).sort((a, b) => a.d - b.d);
  if (fz.length && (fz.length === 1 || fz[0].d < fz[1].d)) return fz[0].x.id;
  return null;
}
const PRIO_WORDS = [[1, ['urgent', 'asap', 'critical', 'blocker', 'blocking', 'p0', 'highest', 'emergency', 'immediately', 'now', 'عاجل', 'ضروري', 'urgentpriority']], [2, ['high', 'p1', 'important', 'major', 'soon', 'عالي', 'مهم', 'highpriority']], [3, ['medium', 'normal', 'p2', 'med', 'mid', 'moderate', 'متوسط', 'mediumpriority']], [4, ['low', 'p3', 'p4', 'minor', 'lowest', 'trivial', 'later', 'whenever', 'منخفض', 'lowpriority']], [0, ['none', 'nopriority', 'no', '']]];
function matchPriority(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && raw >= 0 && raw <= 4) return raw;
  const n = norm(raw); if (/^[0-4]$/.test(n)) return +n;
  for (const [k, ws] of PRIO_WORDS) if (ws.includes(n)) return k;
  for (const [k, ws] of PRIO_WORDS) if (ws.some(w => w.length > 2 && n.includes(w))) return k;
  return undefined;
}
const TYPE_WORDS = { bug: ['bug', 'bugs', 'defect', 'issue', 'error', 'crash', 'fix', 'bugfix', 'problem', 'broken', 'incident', 'hotfix', 'مشكلة', 'خطأ', 'باج'], feature: ['feature', 'request', 'new', 'story', 'userstory', 'requirement', 'req', 'cr', 'changerequest', 'enhancementrequest', 'newfeature', 'ميزة', 'طلب', 'متطلب'], improvement: ['improvement', 'enhancement', 'tweak', 'update', 'improve', 'polish', 'refactor', 'تحسين'], chore: ['chore', 'task', 'ops', 'maintenance', 'admin', 'housekeeping', 'devops', 'مهمة'] };
function matchType(raw) {
  const syn = S.types.map(t => [t, TYPE_WORDS[t.key] || (t.is_bug ? TYPE_WORDS.bug : [])]);
  return matchLabel(raw, S.types, t => t.name, { syn })?.o || null;
}
const BUGGY = /\b(crash|crashes|error|errors|broken|not working|doesn'?t work|does not|fails?|failed|bug|wrong|can'?t|cannot|unable|stuck|freez|missing|404|500|exception|blank screen|not showing|not loading)\b/i;

/* ── dates ── */
function parseDate(v) {
  if (v == null || v === '') return { v: null };
  if (typeof v === 'object' && v.date != null) v = v.date;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number') { if (v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return { v: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` }; } return { bad: true }; }
  const s = String(v).trim().toLowerCase(); const today = new Date(); today.setHours(0, 0, 0, 0);
  const add = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  if (/^(today|اليوم)$/.test(s)) return { v: add(0) };
  if (/^(tomorrow|tmrw|tmr|بكرة|غدا)$/.test(s)) return { v: add(1) };
  let m = s.match(/^in\s+(\d+)\s+(day|days|week|weeks)$/); if (m) return { v: add(+m[1] * (m[2].startsWith('week') ? 7 : 1)) };
  if (/^(next week)$/.test(s)) return { v: add(7) };
  const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  m = s.match(/^(next\s+|this\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/);
  if (m) { const want = WD.findIndex(w => w.startsWith(m[2])); let n = (want - today.getDay() + 7) % 7; if (n === 0 || m[1]?.startsWith('next')) n = n || 7; return { v: add(n) }; }
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) { let a = +m[1], b = +m[2], y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000; // day first, unless that can’t be a date
    if (a <= 12 && b > 12) return ok(y, a, b, true); return ok(y, b, a); }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})\.?,?\s*(\d{4})?$/); if (m) { const mo = MON.findIndex(x => m[2].startsWith(x)); if (mo >= 0) return ok(m[3] ? +m[3] : nextYear(mo, +m[1]), mo + 1, +m[1]); }
  m = s.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/); if (m) { const mo = MON.findIndex(x => m[1].startsWith(x)); if (mo >= 0) return ok(m[3] ? +m[3] : nextYear(mo, +m[2]), mo + 1, +m[2]); }
  const d = new Date(String(v)); if (!isNaN(d)) return { v: iso(d) };
  return { bad: true };
  function nextYear(mo, day) { const y = today.getFullYear(); const d = new Date(y, mo, day); return d < today && (today - d) > 60 * 864e5 ? y + 1 : y; }
  function ok(y, mo, da, swapped) { const d = new Date(y, mo - 1, da); if (d.getMonth() !== mo - 1 || d.getDate() !== da) return { bad: true }; return { v: iso(d), swapped }; }
}

/* ── offline text tidy (no network): spacing, capitals, common typos ── */
const TYPOS = { teh: 'the', recieve: 'receive', recieved: 'received', seperate: 'separate', seperately: 'separately', definately: 'definitely', occured: 'occurred', occurence: 'occurrence', untill: 'until', wich: 'which', wont: "won't", dont: "don't", doesnt: "doesn't", cant: "can't", isnt: "isn't", didnt: "didn't", shouldnt: "shouldn't", wasnt: "wasn't", arent: "aren't", couldnt: "couldn't", thier: 'their', becuase: 'because', becasue: 'because', adress: 'address', accross: 'across', acheive: 'achieve', aparent: 'apparent', begining: 'beginning', beleive: 'believe', calender: 'calendar', comming: 'coming', commited: 'committed', enviroment: 'environment', existant: 'existent', foward: 'forward', goverment: 'government', happend: 'happened', immediatly: 'immediately', independant: 'independent', lenght: 'length', mesage: 'message', neccessary: 'necessary', noticable: 'noticeable', occassion: 'occasion', paymnet: 'payment', payemnt: 'payment', recomend: 'recommend', refered: 'referred', reponse: 'response', responce: 'response', succesful: 'successful', successfull: 'successful', sucessful: 'successful', tommorow: 'tomorrow', tommorrow: 'tomorrow', truely: 'truly', usefull: 'useful', wierd: 'weird', wether: 'whether', writting: 'writing', buton: 'button', butto: 'button', btn: 'button', pasword: 'password', passwrod: 'password', loggin: 'login', notifcation: 'notification', notifiction: 'notification', notfication: 'notification', dashbaord: 'dashboard', dashbord: 'dashboard', databse: 'database', screem: 'screen', scren: 'screen', shoud: 'should', shold: 'should', whne: 'when', wehn: 'when', taht: 'that', hte: 'the', adn: 'and', nad: 'and', aslo: 'also', alot: 'a lot', allways: 'always', avaible: 'available', availble: 'available', appear: 'appear', apear: 'appear', apears: 'appears', dosent: "doesn't", dosnt: "doesn't", doesnot: 'does not', cannt: "can't", mobil: 'mobile', moblie: 'mobile', updae: 'update', udpate: 'update', delet: 'delete', deleated: 'deleted', deleteing: 'deleting', loadin: 'loading', laoding: 'loading', erorr: 'error', eror: 'error', errror: 'error', invlaid: 'invalid', invaild: 'invalid', requst: 'request', reqeust: 'request', userr: 'user', usre: 'user', ammount: 'amount', amout: 'amount', recieving: 'receiving', bookign: 'booking', boking: 'booking' };
const BRANDS = { iphone: 'iPhone', ipad: 'iPad', ios: 'iOS', android: 'Android', whatsapp: 'WhatsApp', macos: 'macOS', pdf: 'PDF', api: 'API', url: 'URL', sms: 'SMS', otp: 'OTP', qr: 'QR', csv: 'CSV', ui: 'UI', ux: 'UX', faq: 'FAQ', wifi: 'Wi-Fi', gps: 'GPS', ok: 'OK' };
function tidyText(s, { title } = {}) {
  if (s == null) return '';
  let t = String(s).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!t) return '';
  t = t.replace(/\s+([,.;:!?])(?=\s|$)/g, '$1').replace(/([,;:])(?=[A-Za-z])/g, '$1 ').replace(/([.!?])\1{1,}/g, '$1').replace(/,{2,}/g, ',');
  t = t.replace(/\b([A-Za-z]+)\b/g, (w) => { const lw = w.toLowerCase(); const r = TYPOS[lw]; if (!r) return w; return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? r[0].toUpperCase() + r.slice(1) : r; });
  t = t.replace(/\b(the|a|an|to|is|in|on|and|of|it)\s+\1\b/gi, '$1');
  t = t.replace(/\b(iphone|ipad|ios|android|whatsapp|macos|pdf|api|url|sms|otp|qr|csv|ui|ux|faq|wifi|gps|ok)\b/g, w => BRANDS[w]);
  t = t.replace(/(^|[\s(])i(?=[\s',.!?)]|$)/g, '$1I').replace(/(^|\s)i'(m|ve|ll|d)\b/g, "$1I'$2");
  // sentence capitals (Latin only); keep words that start lower-case on purpose like iPhone, eBay
  t = t.replace(/(^|[.!?]\s+|\n(?:\d+[.)]\s*|[-•*]\s*)?)([a-z])(?=[a-z]*\b)/g, (m, p, c, off, all) => { const w = all.slice(off + p.length).match(/^[a-zA-Z]+/)?.[0] || ''; return /[A-Z]/.test(w.slice(1)) ? m : p + c.toUpperCase(); });
  if (title) t = t.replace(/\n+/g, ' ').replace(/[.;,]+$/, '');
  if (/^[A-Z0-9\s\W]+$/.test(t) && /[A-Z]{4,}/.test(t) && t.length > 12) t = t.charAt(0) + t.slice(1).toLowerCase(); // shouting
  return t;
}
const cap = s => s.replace(/^([a-z])(?=[a-z]*\b)/, (m, c, o, all) => (/[A-Z]/.test((all.match(/^[a-zA-Z]+/) || [''])[0].slice(1)) ? m : c.toUpperCase()));
function stepsList(s) {
  if (!s) return '';
  let t = String(s).trim();
  if (/\n/.test(t)) {
    const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    if (lines.length > 1 && !lines.every(l => /^(\d+[.)]|[-•*])\s*/.test(l))) return lines.map((l, i) => `${i + 1}. ${cap(l.replace(/^(\d+[.)]|[-•*])\s*/, ''))}`).join('\n');
    return lines.map((l, i) => /^[-•*]\s*/.test(l) ? `${i + 1}. ${l.replace(/^[-•*]\s*/, '')}` : l).join('\n');
  }
  let parts = t.split(/\s*(?:\d+[.)]\s+)/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) parts = t.split(/\s*(?:;|→|->|>>|\bthen\b)\s*/i).map(x => x.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.map((p, i) => `${i + 1}. ${cap(p.replace(/[,.]$/, ''))}`).join('\n') : t;
}

/* ── turn sheet rows into drafts ── */
function rowsToDrafts(rows) {
  const hi = findHeader(rows);
  if (hi < 0) return { error: 'No “Title” column found. Use the Ovrto template, or make sure the first row has a Title column.' };
  const keys = rows[hi].map(headerKey);
  const unknownCols = rows[hi].map((h, i) => (!keys[i] && h != null && String(h).trim() ? String(h).trim() : null)).filter(Boolean);
  const drafts = []; const seen = new Map();
  rows.slice(hi + 1).forEach((r, i) => {
    if (!r || r.every(c => c == null || String(typeof c === 'object' ? c.date : c).trim() === '')) return;
    const get = k => { const j = keys.indexOf(k); return j >= 0 ? r[j] : null; };
    const getAll = pref => keys.map((k, j) => (k && k.startsWith(pref) ? [k.slice(pref.length), r[j]] : null)).filter(Boolean);
    const rawTitle = get('title') == null ? '' : String(get('title'));
    if (/^\s*example\s*:/i.test(rawTitle)) return;
    const d = { row: hi + i + 2, include: true, changes: [], warns: [], orig: {}, fields: {}, secs: {} };
    const ch = (field, from, to, why) => { if (String(from ?? '') !== String(to ?? '')) d.changes.push({ field, from: from ?? '', to: to ?? '', why }); };
    // text
    const desc = get('description') == null ? '' : String(get('description'));
    let title = tidyText(rawTitle, { title: true });
    if (!title && desc.trim()) { title = tidyText(desc.split(/[.\n!?]/)[0].slice(0, 90), { title: true }); d.changes.push({ field: 'Title', from: '', to: title, why: 'taken from the description' }); }
    else ch('Title', rawTitle.trim(), title, 'spelling and spacing');
    if (!title) { d.include = false; d.warns.push('No title, so this row is skipped.'); }
    d.title = title; d.orig.title = rawTitle;
    d.description = tidyText(desc); ch('Description', desc.trim(), d.description, 'spelling and spacing');
    for (const [s, v] of getAll('sec:')) { const raw = v == null ? '' : String(v); let t = tidyText(raw); if (/step/i.test(s)) t = stepsList(t); d.secs[s] = t; ch(s, raw.trim(), t, /step/i.test(s) ? 'tidied into numbered steps' : 'spelling and spacing'); }
    // type
    const rawType = get('type'); let ty = rawType != null && String(rawType).trim() ? matchType(rawType) : null;
    if (rawType != null && String(rawType).trim() && !ty) d.warns.push(`Type “${rawType}” isn’t one of yours, so Ovrto picked one.`);
    if (ty && norm(ty.name) !== norm(rawType)) ch('Type', rawType, ty.name, 'matched to your types');
    if (!ty) {
      const bug = S.types.find(t => t.is_bug); const hasBugSecs = Object.entries(d.secs).some(([s, v]) => v && (tyOf(bug?.id)?.template || []).includes(s));
      ty = bug && (hasBugSecs || BUGGY.test(title + ' ' + d.description)) ? bug : (S.types.find(t => !t.is_bug) || S.types[0]);
      d.changes.push({ field: 'Type', from: rawType || '', to: ty?.name, why: hasBugSecs ? 'it has bug details (steps, expected, actual)' : ty?.is_bug ? 'it reads like a bug' : 'default type' });
    }
    d.type_id = ty?.id || null;
    // priority
    const rp = get('priority'); const p = matchPriority(rp);
    if (p === undefined) { d.priority = 0; d.warns.push(`Priority “${rp}” not understood, so it’s left empty.`); }
    else { d.priority = p ?? 0; if (rp != null && String(rp).trim() && prioName(d.priority).toLowerCase() !== String(rp).trim().toLowerCase()) ch('Priority', rp, prioName(d.priority), 'matched to a priority'); }
    // people
    for (const [k, label] of [['developer', 'Developer'], ['reviewer', 'Reviewer']]) {
      const raw = get(k); if (raw == null || !String(raw).trim()) continue;
      const id = matchPerson(raw);
      if (id) { d[k === 'developer' ? 'assignee_id' : 'reviewer_id'] = id; if (norm(dname(prof(id))) !== norm(raw)) ch(label, raw, dname(prof(id)), 'matched to a teammate'); }
      else d.warns.push(`${label} “${raw}” isn’t in this workspace, so it’s left ${k === 'developer' ? 'unassigned' : 'as the default'}.`);
    }
    // dates, sprint, project, status
    const rd = get('due'); if (rd != null && String(typeof rd === 'object' ? rd.date : rd).trim()) { const pd = parseDate(rd); if (pd.bad) d.warns.push(`Due date “${rd}” isn’t a date Ovrto understands.`); else { d.due_date = pd.v; if (typeof rd === 'string' && rd.trim() !== pd.v) ch('Due date', rd, fmtDate(pd.v) + (pd.swapped ? '' : ''), 'read as a date'); } }
    const rs = get('sprint'); if (rs != null && String(rs).trim()) { const s = String(rs).toLowerCase(); const n = /current|this/.test(s) ? sprintOf() : /next/.test(s) ? sprintOf() + 1 : parseInt(s.replace(/\D+/g, ''), 10); if (n > 0) d.sprint = n; else d.warns.push(`Sprint “${rs}” isn’t a number.`); }
    const rpj = get('project'); if (rpj != null && String(rpj).trim()) { const m = matchLabel(rpj, S.projects, x => x.name); if (m) { d.project_id = m.o.id; if (m.how !== 'exact') ch('Project', rpj, m.o.name, 'matched to a project'); } else d.warns.push(`Project “${rpj}” doesn’t exist, so it’s left empty.`); }
    const rst = get('status'); if (rst != null && String(rst).trim()) { const m = matchLabel(rst, S.statuses, x => x.name); if (m) { d.status_id = m.o.id; if (m.how !== 'exact') ch('Status', rst, m.o.name, 'matched to a status'); } else d.warns.push(`Status “${rst}” isn’t one of yours, so it starts in ${stOf(ty?.default_status)?.name || defaultStatus()?.name}.`); }
    // custom fields (+ Linear-style labels spread over select/multi fields)
    const setOpt = (f, raw) => {
      const parts = f.kind === 'multi' ? String(raw).split(/[,;/|\n]+/).map(x => x.trim()).filter(Boolean) : [String(raw).trim()];
      const got = [];
      for (const part of parts) { const m = matchLabel(part, f.options || [], o => o.label); if (m) { got.push(m.o.id); if (m.how !== 'exact') ch(f.name, part, m.o.label, 'matched to an option'); } else d.warns.push(`${f.name} “${part}” isn’t an option, so it’s skipped.`); }
      if (got.length) d.fields[f.id] = f.kind === 'multi' ? [...new Set([...(d.fields[f.id] || []), ...got])] : got[0];
    };
    for (const [fid, raw] of getAll('f:')) {
      const f = fdOf(fid); if (!f || raw == null || String(typeof raw === 'object' ? raw.date : raw).trim() === '') continue;
      if (f.kind === 'select' || f.kind === 'multi') setOpt(f, raw);
      else if (f.kind === 'person') { const id = matchPerson(raw); if (id) d.fields[f.id] = id; else d.warns.push(`${f.name} “${raw}” isn’t in this workspace.`); }
      else if (f.kind === 'number') { const n = parseFloat(String(raw).replace(/[^\d.-]/g, '')); if (!isNaN(n)) d.fields[f.id] = n; else d.warns.push(`${f.name} “${raw}” isn’t a number.`); }
      else if (f.kind === 'date') { const pd = parseDate(raw); if (pd.v) d.fields[f.id] = pd.v; else d.warns.push(`${f.name} “${raw}” isn’t a date.`); }
      else if (f.kind === 'checkbox') d.fields[f.id] = /^(1|yes|y|true|x|✓|نعم)$/i.test(String(raw).trim());
      else d.fields[f.id] = tidyText(raw);
    }
    const lab = get('labels'); if (lab != null && String(lab).trim()) for (const part of String(lab).split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean)) {
      let placed = false; for (const f of S.fields.filter(f => ['select', 'multi'].includes(f.kind))) { const m = matchLabel(part, f.options || [], o => o.label); if (m && m.how !== 'typo') { d.fields[f.id] = f.kind === 'multi' ? [...new Set([...(d.fields[f.id] || []), m.o.id])] : m.o.id; placed = true; break; } }
      if (!placed) { const t2 = matchType(part); if (t2 && !rawType) { d.type_id = t2.id; placed = true; } }
      if (!placed) d.warns.push(`Label “${part}” doesn’t match any field, so it’s skipped.`);
    }
    // duplicates: in Ovrto already, or twice in this file
    const key = norm(title);
    if (key) {
      const dup = S.tasks.find(t => norm(t.title) === key && !isClosed(t));
      if (dup) { d.dup = dup.id; d.include = false; d.warns.push(`Already in Ovrto as ${taskKey(dup)}, so it’s unticked.`); }
      else { const sim = similarTask(title); if (sim) d.warns.push(`Looks like ${taskKey(sim)} “${sim.title}”. Check it isn’t a duplicate.`); }
      if (seen.has(key)) { d.include = false; d.warns.push(`Same title as row ${seen.get(key)} in this file, so it’s unticked.`); } else seen.set(key, d.row);
    }
    drafts.push(d);
  });
  return { drafts, unknownCols };
}
function similarTask(title) {
  const words = new Set(String(title).toLowerCase().split(/\W+/).filter(w => w.length > 3));
  if (words.size < 3) return null;
  let best = null;
  for (const t of S.tasks) { if (isClosed(t) || !t.title) continue; const tw = new Set(t.title.toLowerCase().split(/\W+/).filter(w => w.length > 3)); const inter = [...words].filter(w => tw.has(w)).length; const j = inter / (words.size + tw.size - inter); if (j >= 0.6 && (!best || j > best.j)) best = { t, j }; }
  return best?.t || null;
}

/* ── spelling and grammar with LanguageTool (free public API; off with one switch) ── */
const LT_URL = 'https://api.languagetool.org/v2/check';
async function ltCheck(drafts, onProgress) {
  const names = new Set([...S.members.map(m => dname(prof(m.user_id))).flatMap(n => n.split(/\s+/)), ...S.fields.flatMap(f => (f.options || []).map(o => o.label)).flatMap(l => l.split(/\s+/)), S.ws.prefix, appName(), ...S.projects.map(p => p.name).flatMap(n => n.split(/\s+/))].map(x => x.toLowerCase()));
  const items = []; // [draft, key, getter, setter, label]
  for (const d of drafts) {
    if (!d.include) continue;
    items.push([d, 'title', 'Title']); if (d.description) items.push([d, 'description', 'Description']);
    for (const s of Object.keys(d.secs)) if (d.secs[s]) items.push([d, 'sec:' + s, s]);
  }
  const getV = (d, k) => (k.startsWith('sec:') ? d.secs[k.slice(4)] : d[k]);
  const setV = (d, k, v) => { if (k.startsWith('sec:')) d.secs[k.slice(4)] = v; else d[k] = v; };
  const SEP = '\n\n\u2063\n\n'; let fixed = 0, i = 0;
  while (i < items.length) {
    const batch = []; let len = 0;
    while (i < items.length && (len + String(getV(items[i][0], items[i][1])).length + SEP.length < 15000 || !batch.length)) { const t = String(getV(items[i][0], items[i][1])); batch.push(items[i]); len += t.length + SEP.length; i++; }
    const texts = batch.map(([d, k]) => String(getV(d, k)));
    const body = new URLSearchParams({ text: texts.join(SEP), language: 'auto', preferredVariants: 'en-US' });
    let res;
    try { const r = await fetch(LT_URL, { method: 'POST', body }); if (r.status === 429) throw new Error('busy'); if (!r.ok) throw new Error('http ' + r.status); res = await r.json(); }
    catch (e) { return { fixed, error: e.message === 'busy' ? 'The free spelling service is busy. Try again in a minute, or carry on without it.' : 'The spelling service couldn’t be reached, so only the offline fixes were made.' }; }
    // map matches back to each text
    const starts = []; let o = 0; for (const t of texts) { starts.push(o); o += t.length + SEP.length; }
    const per = texts.map(() => []);
    for (const m of res.matches || []) {
      const rep = m.replacements?.[0]?.value; if (rep == null) continue;
      const cat = m.rule?.category?.id || ''; if (!/TYPOS|GRAMMAR|CASING|PUNCTUATION|CONFUSED_WORDS|MISC|COLLOCATIONS|NONSTANDARD_PHRASES|SEMANTICS/.test(cat)) continue;
      let idx = starts.length - 1; while (idx > 0 && starts[idx] > m.offset) idx--;
      const local = m.offset - starts[idx]; const word = texts[idx].substr(local, m.length);
      if (local < 0 || local + m.length > texts[idx].length) continue;
      if (cat === 'TYPOS' && (names.has(word.toLowerCase()) || /[A-Z].*[A-Z]|\d|@|\//.test(word) || /^[A-Z]/.test(word) && word.length > 1 && local > 0)) continue;
      per[idx].push({ at: local, len: m.length, rep });
    }
    batch.forEach(([d, k, label], j) => {
      const list = per[j].sort((a, b) => b.at - a.at); if (!list.length) return;
      let t = texts[j]; let last = Infinity;
      for (const x of list) { if (x.at + x.len > last) continue; t = t.slice(0, x.at) + x.rep + t.slice(x.at + x.len); last = x.at; }
      if (t !== texts[j]) {
        const before = texts[j]; setV(d, k, t); fixed++;
        const prev = d.changes.find(c => c.field === label);
        if (prev) { prev.to = t; prev.why = prev.why.includes('grammar') ? prev.why : prev.why + ', grammar'; } else d.changes.push({ field: label, from: before, to: t, why: 'spelling and grammar' });
      }
    });
    onProgress?.(i / items.length);
  }
  return { fixed };
}

/* ── optional AI tidy (Gemini key kept by the workspace admin; called through the notify function) ── */
async function aiStatus() {
  try { const { data, error } = await sb.rpc('ai_status', { ws: S.ws.id }); if (error) return { enabled: false }; return data || { enabled: false }; } catch { return { enabled: false }; }
}
async function aiTidy(drafts) {
  const list = drafts.filter(d => d.include);
  const payload = list.map((d, i) => ({ i, type: tyOf(d.type_id)?.name, title: d.title, description: d.description, sections: d.secs }));
  const ctx = { types: S.types.map(t => ({ name: t.name, sections: t.template || [], bug: !!t.is_bug })), fields: S.fields.filter(f => ['select', 'multi'].includes(f.kind)).map(f => ({ name: f.name, multi: f.kind === 'multi', options: (f.options || []).map(o => o.label) })) };
  const out = [];
  for (let k = 0; k < payload.length; k += 25) {
    const { data, error } = await sb.functions.invoke('notify', { body: { op: 'tidy', ws: S.ws.id, rows: payload.slice(k, k + 25), ctx } });
    if (error || !data?.rows) return { error: data?.error || error?.message || 'AI didn’t answer.' };
    out.push(...data.rows);
  }
  let n = 0;
  for (const r of out) {
    const d = list[r.i]; if (!d) continue; let touched = false;
    const set = (label, cur, val, apply) => { if (val == null) return; val = String(val).trim(); if (!val || val === String(cur || '').trim()) return; d.changes.push({ field: label, from: cur || '', to: val, why: 'AI' }); apply(val); touched = true; };
    set('Title', d.title, r.title, v => { d.title = v; });
    set('Description', d.description, r.description, v => { d.description = v; });
    if (r.type) { const t = matchType(r.type); if (t && t.id !== d.type_id) { d.changes.push({ field: 'Type', from: tyOf(d.type_id)?.name, to: t.name, why: 'AI' }); d.type_id = t.id; touched = true; } }
    for (const [s, v] of Object.entries(r.sections || {})) { const ok = (tyOf(d.type_id)?.template || []).includes(s); if (ok) set(s, d.secs[s], v, val => { d.secs[s] = val; }); }
    for (const [fname, v] of Object.entries(r.fields || {})) {
      const f = S.fields.find(x => norm(x.name) === norm(fname)); if (!f || hasVal(d.fields[f.id])) continue;
      const vals = (Array.isArray(v) ? v : [v]).map(x => matchLabel(x, f.options || [], o => o.label)?.o?.id).filter(Boolean);
      if (vals.length) { d.fields[f.id] = f.kind === 'multi' ? vals : vals[0]; d.changes.push({ field: f.name, from: '', to: vals.map(id => optOf(f, id)?.label).join(', '), why: 'AI suggestion' }); touched = true; }
    }
    if (r.note) d.aiNote = String(r.note).slice(0, 200);
    if (touched) n++;
  }
  return { n };
}

/* ── template ── */
function templateBlob() {
  const secNames = imp_sectionNames();
  const people = S.members.map(m => dname(prof(m.user_id)));
  const selFields = S.fields.filter(f => f.kind !== 'person' || people.length);
  const cols = [
    { k: 'title', h: 'Title *', w: 44, req: true, tip: 'Required. One line: what needs doing or what is broken.' },
    { k: 'type', h: 'Type', w: 14, list: 'Type', tip: `Optional. ${S.types.map(t => t.name).join(', ')}. Leave it empty and Ovrto picks from what you wrote.` },
    { k: 'description', h: 'Description', w: 44, tip: 'Optional. What is needed or what happened. Write it however you like; Ovrto tidies the spelling.' },
    ...secNames.map(s => ({ k: 'sec:' + s, h: s, w: /step/i.test(s) ? 38 : 28, tip: `Optional. For ${S.types.filter(t => (t.template || []).includes(s)).map(t => t.name).join(', ')}.${/step/i.test(s) ? ' One step per line, or separate them with ; or numbers.' : ''}` })),
    ...selFields.map(f => ({ k: 'f:' + f.id, h: f.name, w: f.kind === 'multi' ? 24 : 18, list: ['select', 'person'].includes(f.kind) ? 'f:' + f.id : null, tip: `Optional. ${f.help || ''}${f.kind === 'multi' ? ' One or more, separated by commas.' : ''}${f.kind === 'date' ? ' Any date format.' : ''}`.trim() })),
    { k: 'priority', h: 'Priority', w: 13, list: 'Priority', tip: 'Optional. Urgent, High, Medium or Low. Words like asap or minor also work.' },
    { k: 'developer', h: 'Developer', w: 20, list: 'People', tip: 'Optional. Who will do it: a name, first name or email. Leave it empty and bugs go to their usual developer.' },
    { k: 'reviewer', h: 'Reviewer', w: 20, list: 'People', tip: 'Optional. Who checks it. Leave it empty for the workspace default.' },
    { k: 'due', h: 'Due date', w: 13, tip: 'Optional. Any format: 30/11/2026, 30 Nov, tomorrow, next Thursday.' },
    { k: 'sprint', h: 'Sprint', w: 9, tip: `Optional. A number, or “current” / “next”. The current sprint is ${sprintOf()}.` },
    ...(S.projects.length ? [{ k: 'project', h: 'Project', w: 22, list: 'Project', tip: 'Optional. Must be an existing project.' }] : []),
  ];
  // lists sheet
  const lists = { Type: S.types.map(t => t.name), Priority: PRIOS.filter(p => p.k).map(p => p.n), People: people, Project: S.projects.map(p => p.name) };
  for (const f of selFields) if (f.kind === 'select' || f.kind === 'multi') lists['f:' + f.id] = (f.options || []).map(o => o.label); else if (f.kind === 'person') lists['f:' + f.id] = people;
  const listKeys = Object.keys(lists).filter(k => lists[k].length);
  const listName = k => (k.startsWith('f:') ? fdOf(k.slice(2))?.name : k);
  const maxLen = Math.max(1, ...listKeys.map(k => lists[k].length));
  const listRows = [listKeys.map(k => ({ v: listName(k), s: 1 }))];
  for (let i = 0; i < maxLen; i++) listRows.push(listKeys.map(k => lists[k][i] ?? null));
  // generic example row (never imported: the title starts with “Example:”)
  const sprint = sprintOf(); const due = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const genericFor = f => { const k = (f.key || f.name).toLowerCase(); if (/area|component|module/.test(k)) return 'Web, Payments'; if (/client|customer|account/.test(k)) return 'Acme Inc.'; if (/source/.test(k)) return 'Support ticket #4821'; if (/tier|risk/.test(k)) return (f.options || [])[1]?.label || (f.options || [])[0]?.label || ''; if (/phase|stage/.test(k)) return (f.options || [])[0]?.label || ''; if (f.kind === 'number') return 3; if (f.kind === 'date') return due; if (f.kind === 'checkbox') return 'Yes'; if (f.kind === 'person') return 'Sam Lee'; return f.kind === 'text' ? '' : (f.options || [])[0]?.label || ''; };
  const exVals = { title: 'Example: Checkout button does nothing on Safari', type: S.types.find(t => t.is_bug)?.name || S.types[0]?.name, description: 'Tapping Pay on the checkout page does nothing on iPhone. It works on Chrome.', priority: 'High', developer: 'Alex Morgan', reviewer: 'Sam Lee', due, sprint, project: '' };
  for (const s of secNames) exVals['sec:' + s] = /step/i.test(s) ? '1. Add any item to the cart\n2. Open checkout in Safari\n3. Tap Pay' : /expect/i.test(s) ? 'The payment screen opens' : /actual/i.test(s) ? 'Nothing happens' : /environment|device/i.test(s) ? 'iPhone 15, iOS 18, Safari' : '';
  for (const f of selFields) exVals['f:' + f.id] = genericFor(f);
  const LAST = 500;
  const vals = cols.map((c, j) => { const L = XL.col(j); const out = { ref: `${L}2:${L}${LAST}`, title: c.h.replace(' *', ''), prompt: c.tip }; if (c.list && lists[c.list]?.length) { const li = listKeys.indexOf(c.list); const LL = XL.col(li); out.list = `Lists!$${LL}$2:$${LL}$${lists[c.list].length + 1}`; out.strict = false; } return out; });
  const how = [
    [null, { v: `${appName()} · Import template`, s: 4 }], [null, null],
    [null, { v: 'Add many tasks at once: fill one row per bug or request in the Tasks sheet, then upload this file in ' + appName() + ' (Import → Upload).', s: 6 }], [null, null],
    [null, { v: 'What to fill', s: 5 }],
    [null, { v: 'Only Title is required. Every other column is optional; leave a cell empty if you don’t know.', s: 6 }],
    [null, { v: 'Start from row 3. Row 2 is an example; it is never imported, so you can leave it or delete it.', s: 6 }],
    [null, { v: 'Tap any cell to see a tip for that column. Columns with a list also accept typed values.', s: 6 }],
    [null, null], [null, { v: 'What ' + appName() + ' fixes for you before anything is created', s: 5 }],
    [null, { v: '• Spelling and grammar in titles and descriptions.', s: 6 }],
    [null, { v: '• Names: a first name, a nickname with a typo, or an email all find the right teammate.', s: 6 }],
    [null, { v: '• Words: “asap” becomes Urgent, “defect” becomes Bug, a plural or a typo in a list value still matches.', s: 6 }],
    [null, { v: '• Dates in any format, and steps typed on one line become a numbered list.', s: 6 }],
    [null, { v: '• Rows that already exist, or appear twice, are flagged and left unticked.', s: 6 }],
    [null, { v: 'You see every change side by side and approve it. Nothing is created until you press Create.', s: 6 }],
    [null, null], [null, { v: 'If you leave Developer empty', s: 5 }],
    [null, { v: 'Bugs go to their usual developer using your routing rules. Other tasks stay unassigned until someone picks them up.', s: 6 }],
  ];
  return XL.book([
    { name: 'How to fill', rows: how, widths: [3, 100], grid: false, heights: { 0: 28 } },
    { name: 'Tasks', rows: [cols.map(c => ({ v: c.h, s: c.req ? 2 : 1 })), cols.map(c => ({ v: exVals[c.k] ?? '', s: 3 }))], widths: cols.map(c => c.w), freeze: [1, 1], validations: vals, heights: { 0: 28, 1: 54 }, emptyRows: 60, emptyStyle: 7, cols: cols.length },
    { name: 'Lists', rows: listRows, widths: listKeys.map(() => 22), freeze: [0, 1] },
  ], 1);
}
function downloadTemplate() {
  const blob = templateBlob(); const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `${appName().toLowerCase()}-import-template.xlsx` }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Template downloaded');
}

/* ── word diff for the review screen ── */
function wordDiff(a, b) {
  const A = String(a ?? '').split(/(\s+)/), B = String(b ?? '').split(/(\s+)/);
  if (A.length * B.length > 40000) return [h('del', { text: a }), ' ', h('ins', { text: b })];
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  const push = (cls, t) => { const last = out[out.length - 1]; if (last && last.cls === cls) last.t += t; else out.push({ cls, t }); };
  while (i < A.length && j < B.length) { if (A[i] === B[j]) { push('', A[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', A[i]); i++; } else { push('ins', B[j]); j++; } }
  while (i < A.length) push('del', A[i++]); while (j < B.length) push('ins', B[j++]);
  return out.map(x => (x.cls ? h(x.cls, { text: x.t }) : x.t));
}

/* ── the import sheet ── */
function openImport() {
  const st = { step: 'start', drafts: [], unknownCols: [], file: null, busy: '', spell: store.get('import.spell', true), filter: 'all', ai: null, open: new Set(), notice: '' };
  aiStatus().then(a => { st.ai = a; if (st.step === 'start' || st.step === 'review') draw(); });
  let body, foot, sheetEl;
  const add = (...els) => body.append(...els.flat().filter(x => x != null && x !== false));
  const draw = () => {
    if (!body) return;
    body.replaceChildren(); foot.replaceChildren();
    if (st.step === 'start') drawStart(); else if (st.step === 'review') drawReview(); else if (st.step === 'done') drawDone();
  };
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv', style: { display: 'none' }, 'aria-label': 'Choose a file to import' });
  fileInput.addEventListener('change', () => { const f = fileInput.files[0]; fileInput.value = ''; if (f) handleFile(f); });
  async function handleFile(f) {
    tours.finish('import'); st.file = f.name; st.busy = 'Reading ' + f.name + '…'; draw();
    try {
      const buf = await f.arrayBuffer(); const head = new Uint8Array(buf.slice(0, 4));
      const rows = head[0] === 0x50 && head[1] === 0x4b ? await readXlsx(buf) : readCsv(new TextDecoder().decode(buf));
      const r = rowsToDrafts(rows);
      if (r.error) { st.busy = ''; st.notice = r.error; draw(); return; }
      if (!r.drafts.length) { st.busy = ''; st.notice = 'The file has no rows to import yet. Fill the Tasks sheet from row 3, then upload it again.'; draw(); return; }
      st.drafts = r.drafts; st.unknownCols = r.unknownCols; st.notice = '';
      if (st.spell) {
        st.busy = 'Checking spelling and grammar…'; draw();
        const lt = await ltCheck(st.drafts, p => { st.busy = `Checking spelling and grammar… ${Math.round(p * 100)}%`; const b = $('.imp-busy .ld-t', body); if (b) b.textContent = st.busy; });
        if (lt.error) st.notice = lt.error;
      }
      st.ai = await aiStatus();
      st.busy = ''; st.step = 'review'; draw();
    } catch (e) { st.busy = ''; st.notice = e.message || 'That file couldn’t be read.'; draw(); }
  }
  const spellSwitch = () => h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: st.spell, onchange: e => { st.spell = e.target.checked; store.set('import.spell', st.spell); } }), h('span', {}, 'Check spelling and grammar online with ', h('a', { href: 'https://languagetool.org', target: '_blank', rel: 'noopener', text: 'LanguageTool' }), ' (free; the text is sent to their servers)'));
  function drawStart() {
    const drop = h('button', { class: 'imp-drop', 'data-tour': 'import-upload', onclick: () => fileInput.click() },
      st.busy ? h('b', { class: 'imp-reading' }, loader(st.busy)) : [icon('upload', 26), h('b', { text: 'Upload the filled template' })], h('span', { class: 'sm mute', text: '.xlsx from Excel, Numbers or Google Sheets, or a .csv. A Linear CSV export works too.' }));
    if (st.busy) drop.disabled = true;
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    add(
      h('div', { class: 'imp-steps' },
        h('div', { class: 'imp-step' }, h('span', { class: 'n', text: '1' }), h('div', {}, h('b', { text: 'Download the template' }), h('p', { class: 'sm mute', text: `A spreadsheet with your types, fields, team and an example row. Only Title is required.` }), h('button', { class: 'btn', 'data-tour': 'import-template', onclick: downloadTemplate }, icon('export', 16), 'Download template (.xlsx)'))),
        h('div', { class: 'imp-step' }, h('span', { class: 'n', text: '2' }), h('div', {}, h('b', { text: 'Fill one row per task' }), h('p', { class: 'sm mute', text: 'Write freely. Typos, nicknames and odd dates are fine; Ovrto fixes them and shows you every change before creating anything.'.replace('Ovrto', appName()) }))),
        h('div', { class: 'imp-step' }, h('span', { class: 'n', text: '3' }), h('div', { style: { minWidth: 0, flex: 1 } }, h('b', { text: 'Upload it and review' }), drop))),
      st.busy && st.spell && /spelling/.test(st.busy) ? h('div', { class: 'imp-busy sm mute', role: 'status' }, loader(st.busy)) : null,
      st.notice ? h('div', { class: 'info warn', role: 'alert', text: st.notice }) : null,
      spellSwitch(), fileInput);
    foot.append(...[h('span', { class: 'sm mute', text: st.ai?.enabled ? 'AI tidy is on for this workspace' : isAdmin() ? 'Tip: add an AI key in Settings → AI to rewrite unclear rows' : '' }), h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel')]);
  }
  function counts() { const inc = st.drafts.filter(d => d.include); return { all: st.drafts.length, inc: inc.length, warn: st.drafts.filter(d => d.warns.length).length, changed: st.drafts.filter(d => d.changes.length).length, fixes: st.drafts.reduce((n, d) => n + d.changes.length, 0) }; }
  function drawReview() {
    const c = counts();
    const chips = h('div', { class: 'imp-filters', role: 'group', 'aria-label': 'Show' }, ...[['all', `All ${c.all}`], ['warn', `Needs a look ${c.warn}`], ['changed', `Fixed ${c.changed}`]].map(([k, l]) => h('button', { class: 'fchip' + (st.filter === k ? ' on' : ''), 'aria-pressed': String(st.filter === k), onclick: () => { st.filter = k; draw(); } }, l)));
    const tools = h('div', { class: 'imp-tools' }, chips, h('span', { class: 'sp' }),
      st.ai?.enabled ? h('button', { class: 'btn sm', disabled: !!st.busy, 'data-tour': 'import-ai', onclick: async e => { st.busy = 'AI is tidying the rows…'; draw(); const r = await aiTidy(st.drafts); st.busy = ''; st.notice = r.error ? 'AI tidy didn’t work: ' + r.error : `AI improved ${r.n} row${r.n === 1 ? '' : 's'}.`; draw(); } }, '✦ Improve with AI') : null,
      h('button', { class: 'btn sm ghost', onclick: () => { const all = st.drafts.every(d => d.include || !d.title); st.drafts.forEach(d => { if (d.title) d.include = !all; }); draw(); } }, 'Tick / untick all'));
    add(
      h('div', { class: 'imp-sum' }, h('b', { text: `${st.file}` }), h('span', { class: 'sm mute', text: ` · ${c.all} row${c.all === 1 ? '' : 's'} · ${c.fixes} fix${c.fixes === 1 ? '' : 'es'} made · ${c.warn} need${c.warn === 1 ? 's' : ''} a look` })),
      st.unknownCols.length ? h('div', { class: 'info', text: `Columns not used: ${st.unknownCols.join(', ')}. Rename them to match the template to bring them in.` }) : null,
      st.notice ? h('div', { class: 'info' + (/didn’t|couldn’t|busy/.test(st.notice) ? ' warn' : ''), role: 'status', text: st.notice }) : null,
      st.busy ? h('div', { class: 'imp-busy sm', role: 'status' }, loader(st.busy)) : null,
      tools);
    const list = h('div', { class: 'imp-list', 'data-tour': 'import-review' });
    const shown = st.drafts.filter(d => st.filter === 'all' || (st.filter === 'warn' ? d.warns.length : d.changes.length));
    for (const d of shown) list.append(rowCard(d));
    if (!shown.length) list.append(h('p', { class: 'sm mute', style: { padding: '12px 2px' }, text: 'Nothing here.' }));
    body.append(list);
    const create = h('button', { class: 'btn pri', disabled: !c.inc || !!st.busy, onclick: createAll }, `Create ${c.inc} task${c.inc === 1 ? '' : 's'}`);
    foot.append(h('button', { class: 'btn ghost', onclick: () => { st.step = 'start'; st.drafts = []; st.notice = ''; draw(); } }, 'Upload another file'), h('span', { class: 'sp' }), h('span', { class: 'sm mute', text: st.spell ? 'Spelling by LanguageTool' : '' }), create);
  }
  function rowCard(d) {
    const ty = tyOf(d.type_id); const route = !d.assignee_id ? routeFor({ type_id: d.type_id, fields: d.fields }) : null;
    const chip = (label, onclick, blank) => h('button', { class: 'w' + (blank ? ' blank' : ''), onclick }, label);
    const titleIn = autoGrow(h('textarea', { class: 'imp-title', rows: '1', value: d.title, 'aria-label': `Title, row ${d.row}`, oninput: e => { d.title = e.target.value.replace(/\n+/g, ' '); }, onkeydown: e => { if (e.key === 'Enter') e.preventDefault(); } }));
    const meta = h('div', { class: 'sentence sm' },
      chip(ty?.name || 'Type', e => picker(e.currentTarget, { options: S.types.map(x => ({ v: x.id, label: x.name })), value: d.type_id, search: false, onPick: v => { d.type_id = v; draw(); } })), ' · ',
      chip(d.assignee_id ? dname(prof(d.assignee_id)) : route ? `${first(prof(route.user))} (${route.why})` : 'no developer', e => pickPerson(e.currentTarget, d.assignee_id, v => { d.assignee_id = v; draw(); }), !d.assignee_id && !route), ' · ',
      chip(d.priority ? prioName(d.priority) : 'no priority', e => picker(e.currentTarget, { options: PRIOS.map(p => ({ v: p.k, label: p.n })), value: d.priority, search: false, onPick: v => { d.priority = v; draw(); } }), !d.priority),
      d.due_date ? [' · ', chip('due ' + fmtDate(d.due_date), e => pickDate(e.currentTarget, d.due_date, v => { d.due_date = v; draw(); }))] : null,
      ...S.fields.filter(f => hasVal(d.fields[f.id]) && ['select', 'multi'].includes(f.kind)).map(f => [' · ', h('span', { class: 'mute', text: (Array.isArray(d.fields[f.id]) ? d.fields[f.id] : [d.fields[f.id]]).map(id => optOf(f, id)?.label).filter(Boolean).join(', ') })]));
    const open = st.open.has(d);
    const card = h('div', { class: 'imp-row' + (d.include ? '' : ' off') + (d.warns.length ? ' warned' : '') },
      h('div', { class: 'imp-row-top' },
        h('label', { class: 'imp-tick' }, h('input', { type: 'checkbox', checked: d.include, disabled: !d.title.trim(), 'aria-label': `Import row ${d.row}`, onchange: e => { d.include = e.target.checked; draw(); } })),
        h('span', { class: 'mono sm mute', text: `Row ${d.row}` }), titleIn,
        h('button', { class: 'x', 'aria-expanded': String(open), 'aria-label': open ? 'Hide details' : 'Show details', onclick: () => { open ? st.open.delete(d) : st.open.add(d); draw(); } }, icon('chev', 16))),
      meta,
      d.warns.length ? h('ul', { class: 'imp-warn' }, d.warns.map(w => h('li', { text: w }))) : null,
      d.aiNote ? h('p', { class: 'sm mute', text: 'AI: ' + d.aiNote }) : null,
      d.changes.length ? h('details', { class: 'imp-changes', open: open || undefined }, h('summary', { text: `${d.changes.length} fix${d.changes.length === 1 ? '' : 'es'}` }),
        h('ul', {}, d.changes.map(ch => h('li', {}, h('b', { text: ch.field + ': ' }), h('span', { class: 'imp-diff' }, ...(String(ch.from).length > 0 ? wordDiff(ch.from, ch.to) : [h('ins', { text: ch.to })])), h('span', { class: 'mute', text: ` (${ch.why})` }),
          ch.field === 'Title' || ch.field === 'Description' || (tyOf(d.type_id)?.template || []).includes(ch.field) ? h('button', { class: 'link sm', onclick: () => { if (ch.field === 'Title') d.title = String(ch.from); else if (ch.field === 'Description') d.description = String(ch.from); else d.secs[ch.field] = String(ch.from); d.changes = d.changes.filter(x => x !== ch); draw(); } }, 'Keep original') : null)))) : null,
      open ? h('div', { class: 'imp-edit' },
        h('label', { class: 'field' }, h('span', { class: 'h', text: 'Description' }), autoGrow(h('textarea', { rows: '2', value: d.description, oninput: e => { d.description = e.target.value; } }))),
        ...(tyOf(d.type_id)?.template || []).map(s => h('label', { class: 'field' }, h('span', { class: 'h', text: s }), autoGrow(h('textarea', { rows: '2', value: d.secs[s] || '', oninput: e => { d.secs[s] = e.target.value; } }))))) : null);
    return card;
  }
  async function createAll() {
    const todo = st.drafts.filter(d => d.include && d.title.trim());
    st.busy = `Creating 0 of ${todo.length}…`; draw();
    const made = [];
    for (const d of todo) {
      const tmpl = tyOf(d.type_id)?.template || [];
      const extra = Object.entries(d.secs).filter(([s, v]) => v && !tmpl.includes(s)).map(([s, v]) => ({ h: s, body: v }));
      const description = joinSections([{ h: '', body: d.description || '' }, ...tmpl.map(s => ({ h: s, body: (d.secs[s] || '').trim() })).filter(s => s.body), ...extra]);
      const row = { type_id: d.type_id, title: d.title.trim(), description, priority: d.priority || 0, fields: d.fields, assignee_id: d.assignee_id || null, sprint: d.sprint ?? null, due_date: d.due_date || null, project_id: d.project_id || null };
      if (d.reviewer_id) row.reviewer_id = d.reviewer_id; if (d.status_id) row.status_id = d.status_id;
      const t = await createTask(row);
      if (t) made.push(t);
      st.busy = `Creating ${made.length} of ${todo.length}…`; const b = $('.imp-busy .ld-t', body); if (b) b.textContent = st.busy;
    }
    st.busy = ''; st.made = made; st.step = 'done'; draw(); if (made.length) track('import');
  }
  function drawDone() {
    const made = st.made || []; const routed = made.filter(t => t.assignee_id).length;
    body.append(h('div', { class: 'imp-done' }, h('b', { class: 'big', text: `${made.length} task${made.length === 1 ? '' : 's'} created` }),
      h('p', { class: 'sm mute', text: `${routed} with a developer${made.length - routed ? `, ${made.length - routed} still unassigned` : ''}. Everyone with a new task gets an alert.` }),
      h('ul', { class: 'imp-made' }, made.slice(0, 50).map(t => h('li', {}, h('button', { class: 'link', onclick: () => { closeSheet(true); openTask(t.id); } }, `${taskKey(t)}`), ' ', t.title)))));
    foot.append(h('button', { class: 'btn ghost', onclick: () => { st.step = 'start'; st.drafts = []; st.notice = ''; draw(); } }, 'Import more'), h('span', { class: 'sp' }), h('button', { class: 'btn pri', onclick: () => { closeSheet(true); go({ v: 'all' }); } }, 'See all tasks'));
  }
  openSheet({ title: 'Import tasks', kind: 'center', key: 'import', full: isPhone(), build: sh => {
    sheetEl = sh; body = h('div', { class: 'sbody imp' }); foot = h('div', { class: 'sfoot' });
    sh.append(body, foot); draw();
  } });
  tours.request('import');
}

