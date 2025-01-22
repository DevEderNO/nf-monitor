
export interface ISiegCountNotesRequest {
  DataEmissaoInicio: string;
  DataEmissaoFim: string;
}

export enum SiegXmlType {
  NFe = 1,
  CTe = 2,
  NFSe = 3,
  NFCe = 4,
  CFe = 5,
}

export interface ISiegCountNotesResponse {
  NFe: number;
  NFCe: number;
  CTe: number;
  CFe: number;
  NFSe: number;
}

export interface ISiegDownloadNotesRequest {
  XmlType: SiegXmlType;
  Take: number;
  Skip: number;
  CnpjEmit?: string;
  CnpjDest?: string;
  CnpjTom?: string;
  DataEmissaoInicio: string;
  DataEmissaoFim: string;
}

export interface ISiegDownloadNotesResponse {
  xmls: string[];
}
