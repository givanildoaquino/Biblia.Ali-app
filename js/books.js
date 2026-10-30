// Livros canônicos (66), na mesma ordem dos arquivos em data/*.json
// [nome PT, abreviação PT, nome EN, abreviação EN]
const BOOKS = [
  ["Gênesis", "Gn", "Genesis", "Gen"],
  ["Êxodo", "Êx", "Exodus", "Exod"],
  ["Levítico", "Lv", "Leviticus", "Lev"],
  ["Números", "Nm", "Numbers", "Num"],
  ["Deuteronômio", "Dt", "Deuteronomy", "Deut"],
  ["Josué", "Js", "Joshua", "Josh"],
  ["Juízes", "Jz", "Judges", "Judg"],
  ["Rute", "Rt", "Ruth", "Ruth"],
  ["1 Samuel", "1Sm", "1 Samuel", "1Sam"],
  ["2 Samuel", "2Sm", "2 Samuel", "2Sam"],
  ["1 Reis", "1Rs", "1 Kings", "1Kgs"],
  ["2 Reis", "2Rs", "2 Kings", "2Kgs"],
  ["1 Crônicas", "1Cr", "1 Chronicles", "1Chr"],
  ["2 Crônicas", "2Cr", "2 Chronicles", "2Chr"],
  ["Esdras", "Ed", "Ezra", "Ezra"],
  ["Neemias", "Ne", "Nehemiah", "Neh"],
  ["Ester", "Et", "Esther", "Esth"],
  ["Jó", "Jó", "Job", "Job"],
  ["Salmos", "Sl", "Psalms", "Ps"],
  ["Provérbios", "Pv", "Proverbs", "Prov"],
  ["Eclesiastes", "Ec", "Ecclesiastes", "Eccl"],
  ["Cânticos", "Ct", "Song of Songs", "Song"],
  ["Isaías", "Is", "Isaiah", "Isa"],
  ["Jeremias", "Jr", "Jeremiah", "Jer"],
  ["Lamentações", "Lm", "Lamentations", "Lam"],
  ["Ezequiel", "Ez", "Ezekiel", "Ezek"],
  ["Daniel", "Dn", "Daniel", "Dan"],
  ["Oseias", "Os", "Hosea", "Hos"],
  ["Joel", "Jl", "Joel", "Joel"],
  ["Amós", "Am", "Amos", "Amos"],
  ["Obadias", "Ob", "Obadiah", "Obad"],
  ["Jonas", "Jn", "Jonah", "Jonah"],
  ["Miqueias", "Mq", "Micah", "Mic"],
  ["Naum", "Na", "Nahum", "Nah"],
  ["Habacuque", "Hc", "Habakkuk", "Hab"],
  ["Sofonias", "Sf", "Zephaniah", "Zeph"],
  ["Ageu", "Ag", "Haggai", "Hag"],
  ["Zacarias", "Zc", "Zechariah", "Zech"],
  ["Malaquias", "Ml", "Malachi", "Mal"],
  ["Mateus", "Mt", "Matthew", "Matt"],
  ["Marcos", "Mc", "Mark", "Mark"],
  ["Lucas", "Lc", "Luke", "Luke"],
  ["João", "Jo", "John", "John"],
  ["Atos", "At", "Acts", "Acts"],
  ["Romanos", "Rm", "Romans", "Rom"],
  ["1 Coríntios", "1Co", "1 Corinthians", "1Cor"],
  ["2 Coríntios", "2Co", "2 Corinthians", "2Cor"],
  ["Gálatas", "Gl", "Galatians", "Gal"],
  ["Efésios", "Ef", "Ephesians", "Eph"],
  ["Filipenses", "Fp", "Philippians", "Phil"],
  ["Colossenses", "Cl", "Colossians", "Col"],
  ["1 Tessalonicenses", "1Ts", "1 Thessalonians", "1Thess"],
  ["2 Tessalonicenses", "2Ts", "2 Thessalonians", "2Thess"],
  ["1 Timóteo", "1Tm", "1 Timothy", "1Tim"],
  ["2 Timóteo", "2Tm", "2 Timothy", "2Tim"],
  ["Tito", "Tt", "Titus", "Titus"],
  ["Filemom", "Fm", "Philemon", "Phlm"],
  ["Hebreus", "Hb", "Hebrews", "Heb"],
  ["Tiago", "Tg", "James", "Jas"],
  ["1 Pedro", "1Pe", "1 Peter", "1Pet"],
  ["2 Pedro", "2Pe", "2 Peter", "2Pet"],
  ["1 João", "1Jo", "1 John", "1John"],
  ["2 João", "2Jo", "2 John", "2John"],
  ["3 João", "3Jo", "3 John", "3John"],
  ["Judas", "Jd", "Jude", "Jude"],
  ["Apocalipse", "Ap", "Revelation", "Rev"],
];

const OT_COUNT = 39;

// Versões disponíveis (todas offline, em data/)
const VERSIONS = {
  bpm: { lang: "pt", short: "BPM", name: "Bíblia Portuguesa Mundial", license: "Domínio público — eBible.org" },
  blivre: {
    lang: "pt", short: "BLIVRE", name: "Bíblia Livre",
    license: "Bíblia Livre (BLIVRE), © Diego Santos, Mario Sérgio e Marco Teles, fev. 2018. Licença Creative Commons Atribuição 4.0 Brasil. Fonte: eBible.org",
  },
  web: { lang: "en", short: "WEB", name: "World English Bible", license: "Public domain — eBible.org. \"World English Bible\" é marca registrada de eBible.org" },
};

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const refKey = (s) => s.toLowerCase().replace(/[\s.]/g, "");

// Mapas de busca: com acento (exato) e sem acento
const BOOK_EXACT = new Map();
const BOOK_PLAIN = new Map();
BOOKS.forEach(([pt, ptA, en, enA], i) => {
  for (const name of [ptA, pt, enA, en]) {
    const k = refKey(name);
    if (!BOOK_EXACT.has(k)) BOOK_EXACT.set(k, i);
    const p = stripAccents(k);
    if (!BOOK_PLAIN.has(p)) BOOK_PLAIN.set(p, i);
  }
});
BOOK_PLAIN.set("jo", 42); // "Jo" = João (Jó só com acento)

function findBook(raw) {
  const k = refKey(raw);
  if (!k) return -1;
  if (BOOK_EXACT.has(k)) return BOOK_EXACT.get(k);
  const p = stripAccents(k);
  if (BOOK_PLAIN.has(p)) return BOOK_PLAIN.get(p);
  // prefixo do nome completo (ex.: "gen", "apoc", "revel")
  for (let i = 0; i < BOOKS.length; i++) {
    const [pt, , en] = BOOKS[i];
    if (stripAccents(refKey(pt)).startsWith(p) || refKey(en).startsWith(p)) return i;
  }
  return -1;
}

// "Jo 3:16", "João 3.16-18", "1 Co 13", "Sl 23:1-3", "John 3:16"
function parseRef(text) {
  const m = String(text).trim().match(/^([1-3]?\s*[^\d:]+?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/);
  if (!m) return null;
  const b = findBook(m[1]);
  if (b < 0) return null;
  const c = parseInt(m[2], 10);
  const v1 = m[3] ? parseInt(m[3], 10) : null;
  let v2 = m[4] ? parseInt(m[4], 10) : v1;
  if (v1 && v2 < v1) v2 = v1;
  return { b, c, v1, v2 };
}

function formatRef({ b, c, v1, v2 }, lang = "pt") {
  const name = BOOKS[b][lang === "en" ? 2 : 0];
  if (!v1) return `${name} ${c}`;
  return v2 && v2 !== v1 ? `${name} ${c}:${v1}-${v2}` : `${name} ${c}:${v1}`;
}
