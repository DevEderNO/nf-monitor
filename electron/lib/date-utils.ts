import { isValid, parseISO, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

export function toDate(text: string): Date | null {
  const textReplaced = text
    .trim()
    .replace(/\//g, "")
    .replace(/ -/g, "")
    .replace(/-/g, "")
    .replace(/ GMT$/, "")
    .replace(/ UTC$/, "");
  let date = parseISO(text);
  if (isValid(date)) return date;
  date = parseISO(textReplaced);
  if (isValid(date)) return date;
  date = parse(text, "d 'de' MMMM 'de' yyyy", new Date(), { locale: ptBR });
  if (isValid(date)) return date;
  date = parse(textReplaced, "EEE, ddMMMyyyy HH:mm:ss", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "yyyyMMdd'T'HH:mm:ss", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "yyyyMMdd HH:mm:ss", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "yyyyMMdd HH:mm", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "ddMMyyyy'T'HH:mm:ss", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "ddMMyyyy HH:mm:ss", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "ddMMyyyy HH:mm", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "yyyyMMdd", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "ddMMyyyy", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "MMMMyyyy", new Date(), { locale: ptBR });
  if (isValid(date)) return date;
  date = parse(textReplaced, "MMM'.'yyyy", new Date(), { locale: ptBR });
  if (isValid(date)) return date;
  date = parse(textReplaced, "MMyyyy", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "MMyyyy", new Date());
  if (isValid(date)) return date;
  date = parse(textReplaced, "yyyyM", new Date());
  if (isValid(date)) return date;
  return null;
}
