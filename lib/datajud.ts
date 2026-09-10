// Integracao com o DataJud (CNJ) - consulta publica de movimentacoes processuais.
// A API Key publica e mantida pelo CNJ e pode ser trocada por eles a qualquer
// momento (ver https://datajud-wiki.cnj.jus.br). E configurada via a variavel
// de ambiente DATAJUD_API_KEY.

// Tabela oficial de codigos de tribunal por segmento (Resolucao CNJ 65/2008).
const UF_ORDER = [
  "ac", "al", "ap", "am", "ba", "ce", "dft", "es", "go", "ma", "mt", "ms",
  "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc",
  "se", "sp", "to",
];

function buildEstadualAliases(prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  UF_ORDER.forEach((uf, idx) => {
    const codigo = String(idx + 1).padStart(2, "0");
    map[codigo] = `api_publica_${prefix}${uf}`;
  });
  return map;
}

// Segmento 8: Justica Estadual (TJs)
const SEGMENTO_8 = buildEstadualAliases("tj");
// Segmento 6: Justica Eleitoral (TREs) - tribunal "00" e o TSE, tratado a parte
const SEGMENTO_6 = buildEstadualAliases("tre-");
// Segmento 9: Justica Militar Estadual - so existe em MG, RS e SP
const SEGMENTO_9: Record<string, string> = {
  [String(UF_ORDER.indexOf("mg") + 1).padStart(2, "0")]: "api_publica_tjmmg",
  [String(UF_ORDER.indexOf("rs") + 1).padStart(2, "0")]: "api_publica_tjmrs",
  [String(UF_ORDER.indexOf("sp") + 1).padStart(2, "0")]: "api_publica_tjmsp",
};
// Segmento 4: Justica Federal (TRF1 a TRF6)
const SEGMENTO_4: Record<string, string> = {
  "01": "api_publica_trf1",
  "02": "api_publica_trf2",
  "03": "api_publica_trf3",
  "04": "api_publica_trf4",
  "05": "api_publica_trf5",
  "06": "api_publica_trf6",
};
// Segmento 5: Justica do Trabalho (TRT1 a TRT24)
const SEGMENTO_5: Record<string, string> = {};
for (let i = 1; i <= 24; i++) {
  SEGMENTO_5[String(i).padStart(2, "0")] = `api_publica_trt${i}`;
}

const SEGMENTO_MAP: Record<string, Record<string, string>> = {
  "4": SEGMENTO_4,
  "5": SEGMENTO_5,
  "6": SEGMENTO_6,
  "8": SEGMENTO_8,
  "9": SEGMENTO_9,
};

// Tribunais superiores: identificados pelo segmento quando o codigo do
// tribunal e "00".
const SUPERIORES: Record<string, string> = {
  "3": "api_publica_stj",
  "5": "api_publica_tst",
  "6": "api_publica_tse",
  "7": "api_publica_stm",
};

export interface ParsedCnj {
  sequencial: string;
  digitoVerificador: string;
  ano: string;
  segmento: string;
  tribunal: string;
  orgao: string;
}

// Numero CNJ no formato NNNNNNN-DD.AAAA.J.TR.OOOO
export function parseCnjNumber(cnj: string): ParsedCnj | null {
  const clean = cnj.replace(/[^\d]/g, "");
  if (clean.length !== 20) return null;
  return {
    sequencial: clean.slice(0, 7),
    digitoVerificador: clean.slice(7, 9),
    ano: clean.slice(9, 13),
    segmento: clean.slice(13, 14),
    tribunal: clean.slice(14, 16),
    orgao: clean.slice(16, 20),
  };
}

export function getTribunalAlias(cnj: string): string | null {
  const parsed = parseCnjNumber(cnj);
  if (!parsed) return null;
  if (parsed.tribunal === "00" && SUPERIORES[parsed.segmento]) {
    return SUPERIORES[parsed.segmento];
  }
  const table = SEGMENTO_MAP[parsed.segmento];
  return table?.[parsed.tribunal] || null;
}

export function isDataJudConfigured(): boolean {
  return Boolean(process.env.DATAJUD_API_KEY);
}

export async function fetchMovimentacoes(cnjNumber: string): Promise<
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; movimentos: any[] }
> {
  if (!isDataJudConfigured()) {
    return { configured: false };
  }

  const alias = getTribunalAlias(cnjNumber);
  if (!alias) {
    return {
      configured: true,
      error: "Nao foi possivel identificar o tribunal a partir deste numero CNJ.",
    };
  }

  const clean = cnjNumber.replace(/[^\d]/g, "");
  const url = `https://api-publica.datajud.cnj.jus.br/${alias}/_search`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${process.env.DATAJUD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: clean } },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { configured: true, error: `DataJud respondeu ${res.status}: ${detail.slice(0, 300)}` };
  }

  const data = await res.json();
  const hit = data?.hits?.hits?.[0]?._source;
  return { configured: true, movimentos: hit?.movimentos || [] };
}
