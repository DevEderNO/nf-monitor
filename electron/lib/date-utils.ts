import { isValid, parseISO, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

export function toDate(text: string): Date {
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
  return date;
}

export function testToDate() {
  try {
    console.log("01072019", toDate("01072019"));
    console.log("2018-07-25T00:00:00", toDate("2018-07-25T00:00:00"));
    console.log("01/2019", toDate("01/2019"));
    console.log("04/2019", toDate("04/2019"));
    console.log(
      "2020-03-31T21:42:44-03:00",
      toDate("2020-03-31T21:42:44-03:00")
    );
    console.log(
      "2020-03-31T21:42:44-03:00",
      toDate("2020-03-31T21:42:44-03:00")
    );
    console.log("01/02/2001", toDate("01/02/2001"));
    console.log("01-02-2001", toDate("01-02-2001"));
    console.log("01022001", toDate("01022001"));
    console.log("2001/02/01", toDate("2001/02/01"));
    console.log("2001-02-01", toDate("2001-02-01"));
    console.log("20010201", toDate("20010201"));
    console.log("16 de março de 2022", toDate("16 de março de 2022"));
    console.log("25/01/2021 15:54", toDate("25/01/2021 15:54"));
    console.log("25/01/2021 15:54:31", toDate("25/01/2021 15:54:31"));
    console.log("20234", toDate("20234"));
    console.log("2023-04-05 - 18:00:33", toDate("2023-04-05 - 18:00:33"));
    console.log("Abril/2023", toDate("Abril/2023"));
    console.log("Abr./2023", toDate("Abr./2023"));
    console.log("2022-10-10 16:29:14.273", toDate("2022-10-10 16:29:14.273"));
    console.log("2022-08-03 15:52:14", toDate("2022-08-03 15:52:14"));
    console.log("2022-11-03 12:17:53.6", toDate("2022-11-03 12:17:53.6"));
    console.log(
      "2022-08-04T11:32:00.999-03:00",
      toDate("2022-08-04T11:32:00.999-03:00")
    );
    console.log("2022-08-30T15:14:15.303", toDate("2022-08-30T15:14:15.303"));
    console.log("2022-10-31T17:19:56Z", toDate("2022-10-31T17:19:56Z"));
    console.log(
      "2023-01-20 19:43:58.35 UTC",
      toDate("2023-01-20 19:43:58.35 UTC")
    );
    console.log("2023-01-16T14:54:41.35", toDate("2023-01-16T14:54:41.35"));
    console.log("2023-01-16T14:54:49.5", toDate("2023-01-16T14:54:49.5"));
    console.log(
      "2022-10-10 16:29:14.273 UTC",
      toDate("2022-10-10 16:29:14.273 UTC")
    );
    console.log(
      "2023-03-08T15:03:18.407-03:00",
      toDate("2023-03-08T15:03:18.407-03:00")
    );
    console.log(
      "2023-03-08T00:00:00-03:00",
      toDate("2023-03-08T00:00:00-03:00")
    );
    console.log(
      "2022-10-13T17:21:07-03:00",
      toDate("2022-10-13T17:21:07-03:00")
    );
    console.log(
      "2023-03-06T18:22:45.1340467-03:00",
      toDate("2023-03-06T18:22:45.1340467-03:00")
    );
    console.log("2023-04-01T03:00:00.000Z", toDate("2023-04-01T03:00:00.000Z"));
    console.log(
      "Fri, 16-Jun-2023 16:18:09 GMT",
      toDate("Fri, 16-Jun-2023 16:18:09 GMT")
    );
    console.log(
      "2023-09-11T13:20:02.732809",
      toDate("2023-09-11T13:20:02.732809")
    );
    console.log(
      "2023-09-11T13:20:04.82657",
      toDate("2023-09-11T13:20:04.82657")
    );
    console.log("2023-09-11T13:20:01.9672", toDate("2023-09-11T13:20:01.9672"));
  } catch (error) {
    console.log(error);
  }
}
