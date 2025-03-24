import * as cheerio from "cheerio";
import { toDate } from "./date-utils";

export const emissaoSelectors = [
  "data_emissao",
  "DataEmissao",
  "DataEmissaoNFe",
  "dtEmissao",
  "data_nfse",
  "tsDatEms",
  "prestacao",
  "dEmi",
  "dhProc",
  "DTDATA",
  "DtEmiNf",
  "DtHrGerNf",
  "DT_COMPETENCIA",
  "nfse:DataEmissao",
  "ns3:DataEmissao",
  "ns2:DataEmissao",
  "issweb:dataEmissao",
  "Emissao",
  "data",
];

export function getDataEmissao(htmlString: string): Date | null {
  const html = cheerio.load(htmlString);
  if (!html) return null;
  if (html._root.childNodes.length == 0) return null;
  let date = "";
  for (let i = 0; i < emissaoSelectors.length; i++) {
    const element = emissaoSelectors[i];
    html("*").each((_, elemento) => {
      if (
        html(elemento)
          .prop("name")
          .toLowerCase()
          .startsWith(element.toLowerCase())
      ) {
        const text = html(elemento).text().trim();
        if (text.length > 0) {
          date = text;
          return false;
        }
      }
    });
    if (date.length > 0) break;
  }
  return toDate(date);
}
