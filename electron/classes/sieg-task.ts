import { format } from "date-fns";
import { IDbHistoric } from "../interfaces/db-historic";
import { IEmpresa } from "../interfaces/empresa";
import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import { ISiegCountNotesResponse, SiegXmlType } from "../interfaces/sieg";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { downloadNotes, getCountNotes } from "../lib/axios";
import {
  addCountedNotes,
  addHistoric,
  getConfiguration,
  getCountedNotes,
  getEmpresas,
  updateCountedNotes,
} from "../services/database";
import { connection } from "websocket";
import fs from "fs";
import { ensureDirSync } from "fs-extra";
import { RoleTypeSieg } from "@prisma/client";
import { IConfig } from "../interfaces/config";
import { getDataEmissao } from "../lib/nfse-utils";

export class SiegTask {
  isPaused: boolean;
  isCancelled: boolean;
  pausedMessage: string | null;
  cancelledMessage: string | null;
  connection: connection | null;
  historic: IDbHistoric;
  empresas: IEmpresa[];
  countNotes: ISiegCountNotesResponse;
  config: IConfig | null;
  dateInitial: Date | null;
  dateEnd: Date | null;

  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.pausedMessage = null;
    this.cancelledMessage = null;
    this.connection = null;
    this.empresas = [];
    this.config = null;
    this.dateInitial = null;
    this.dateEnd = null;
    this.countNotes = { NFe: 0, NFCe: 0, CTe: 0, CFe: 0, NFSe: 0 };
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.pausedMessage = null;
  }

  cancel() {
    this.isCancelled = true;
  }

  async run(connection: connection, dateInitial: Date, dateEnd: Date) {
    try {
      await this.sendMessageClient([]);
      this.initializeProperties(connection);
      const config = await getConfiguration();
      if (!config || !config.apiKeySieg)
        throw new Error("Configuração não encontrada");

      if (this.empresas.length === 0) {
        this.empresas = await getEmpresas();
      }

      if (this.empresas.length === 0) {
        await this.sendMessageClient(
          ["Nenhuma empresa encontrada"],
          0,
          ProcessamentoStatus.Stopped
        );
        return;
      }

      await this.sendMessageClient(
        ["Iniciando contagem de notas"],
        0,
        ProcessamentoStatus.Running
      );

      this.config = config;
      this.dateInitial = dateInitial;
      this.dateEnd = dateEnd;

      await this.countNotesPerCompany();

      await this.sendMessageClient(
        [`Finalizado a contagem de notas`],
        0,
        ProcessamentoStatus.Running
      );

      await this.sendMessageClient(
        [`Iniciando o processo de download das notas fiscais`],
        0,
        ProcessamentoStatus.Running
      );

      await this.downloadNotes(SiegXmlType.NFe);
      await this.downloadNotes(SiegXmlType.CTe);
      await this.downloadNotes(SiegXmlType.NFSe);
      await this.downloadNotes(SiegXmlType.NFCe);
      await this.downloadNotes(SiegXmlType.CFe);

      await this.sendMessageClient(
        [`😁 Finalizado o processo de download das notas fiscais`],
        0,
        ProcessamentoStatus.Concluded
      );
      await this.sendMessageClient([""], 0, ProcessamentoStatus.Concluded);
    } catch (error) {
      throw error;
    }
  }

  async downloadNotes(xmlType: SiegXmlType) {
    if (await this.checkIfCancelled()) return;
    const countNotes = await getCountedNotes(this.dateInitial!, this.dateEnd!);
    if (!countNotes) return;

    const countNotesXmlType = Object.entries(countNotes).find(
      (x) => x[0].toLowerCase() === SiegXmlType[xmlType].toLowerCase()
    )?.[1];
    if (!countNotesXmlType || countNotesXmlType === 0) return;

    //download NFe de 50 em 50 até o total de notas o xml esta em base64 deve ser salvo em arquivo na pasta de download
    for (let i = 0; i < countNotesXmlType; i += 50) {
      if (await this.checkIfCancelled()) return;
      if (await this.checkIfPaused()) {
        await timeout(250);
        i -= 50;
        continue;
      } else {
        await this.sendMessageClient(
          [
            `📦 Realizando o download das ${
              SiegXmlType[xmlType]
            } - ${i} a ${Math.min(
              i + 50,
              countNotesXmlType
            )} de ${countNotesXmlType}`,
          ],
          0,
          ProcessamentoStatus.Running
        );
        const downloadNFe = await downloadNotes(this.config?.apiKeySieg!, {
          ...{
            XmlType: xmlType,
            Take: 50,
            Skip: i,
            DataEmissaoInicio: format(this.dateInitial!, "yyyy-MM-dd"),
            DataEmissaoFim: format(this.dateEnd!, "yyyy-MM-dd"),
          },
        });
        for (let i = 0; i < downloadNFe.xmls.length; i++) {
          if (await this.checkIfCancelled()) return;
          if (await this.checkIfPaused()) {
            await timeout(250);
            i--;
            continue;
          } else {
            let emitente = "";
            let ano = "";
            let mes = "";
            let destinatario: string | null = null;
            const xml = downloadNFe.xmls[i];
            const xmlString = Buffer.from(xml, "base64").toString("utf-8");
            if (xmlType !== SiegXmlType.NFSe) {
              const regex = this.getChaveRegex(xmlType);
              const chave = regex
                ? xmlString.match(regex)?.[1]
                : xmlString.substring(0, 10) + new Date().getTime().toString();
              if (chave?.length === 44) {
                ano = chave.substring(2, 4);
                mes = chave.substring(4, 6);
                emitente = chave.substring(6, 20);
                destinatario = await this.getDestination(
                  xmlType,
                  xmlString.toString()
                );
                if (
                  destinatario &&
                  destinatario.length > 0 &&
                  !this.empresas.map((x) => x.cnpj).includes(destinatario)
                ) {
                  this.saveStandardizedFile(
                    Number(ano),
                    Number(mes),
                    emitente,
                    xmlType,
                    chave,
                    xmlString
                  );
                } else {
                  this.saveStandardizedFile(
                    Number(ano),
                    Number(mes),
                    emitente,
                    xmlType,
                    chave,
                    xmlString
                  );
                }
              }
            } else {
              const dataEmissao = getDataEmissao(xmlString);
              if (dataEmissao) {
                ano = format(dataEmissao, "yy");
                mes = format(dataEmissao, "MM");
              } else {
                ano = format(this.dateInitial!, "'9000'yy");
                mes = format(this.dateInitial!, "'9000'MM");
              }
              this.saveNfseFile(Number(ano), Number(mes), xmlString);
            }
          }
        }
      }
    }
    await this.sendMessageClient(
      [`Finalizado o download das ${SiegXmlType[xmlType]}`],
      0,
      ProcessamentoStatus.Running
    );
  }

  private async getDestination(
    xmlType: SiegXmlType,
    xmlString: string
  ): Promise<string | null> {
    switch (xmlType) {
      case SiegXmlType.NFe:
        return (
          xmlString
            .match(/<dest>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
            .replace(/[^\d]/g, "") ?? null
        );
      case SiegXmlType.NFCe:
        return (
          xmlString
            .match(/<dest>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
            .replace(/[^\d]/g, "") ?? null
        );
      case SiegXmlType.CTe:
        const tagToma = xmlString.match(/<toma>(\d{1})<\/toma>/gi)?.[0];
        switch (tagToma?.replace(/[^\d]/g, "")) {
          case "0":
            return (
              xmlString
                .match(/<rem>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
                .replace(/[^\d]/g, "") ?? null
            );
          case "1":
            return (
              xmlString
                .match(/<exped>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
                .replace(/[^\d]/g, "") ?? null
            );
          case "2":
            return (
              xmlString
                .match(/<receb>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
                .replace(/[^\d]/g, "") ?? null
            );
          case "3":
            return (
              xmlString
                .match(/<dest>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
                .replace(/[^\d]/g, "") ?? null
            );
          case "4":
            return (
              xmlString
                .match(/<dest>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
                .replace(/[^\d]/g, "") ?? null
            );
          default:
            return null;
        }
      case SiegXmlType.CFe:
        return (
          xmlString
            .match(/<dest>\s*<CNPJ>(\d{14})<\/CNPJ>/gi)?.[0]
            .replace(/[^\d]/g, "") ?? null
        );
      default:
        return null;
    }
  }

  private async saveStandardizedFile(
    ano: number,
    mes: number,
    cnpj: string,
    xmlType: SiegXmlType,
    chave: string,
    xml: string
  ) {
    ensureDirSync(
      `${this.config?.directoryDownloadSieg}/${ano}/${mes}/${cnpj}/${SiegXmlType[xmlType]}`
    );
    fs.writeFileSync(
      `${this.config?.directoryDownloadSieg}/${ano}/${mes}/${cnpj}/${SiegXmlType[xmlType]}/${chave}.xml`,
      xml
    );
  }

  private async saveNfseFile(ano: number, mes: number, xml: string) {
    ensureDirSync(
      `${this.config?.directoryDownloadSieg}/${ano}/${mes}/${
        SiegXmlType[SiegXmlType.NFSe]
      }`
    );
    fs.writeFileSync(
      `${this.config?.directoryDownloadSieg}/${ano}/${mes}/${
        SiegXmlType[SiegXmlType.NFSe]
      }/${ano + mes + new Date().getTime().toString()}.xml`,
      xml
    );
  }

  private getChaveRegex(xmlType: SiegXmlType) {
    switch (xmlType) {
      case SiegXmlType.NFe:
      case SiegXmlType.NFCe:
        return /Id="NFe(\d{44})"/;
      case SiegXmlType.CTe:
        return /Id="CTe(\d{44})"/;
      case SiegXmlType.CFe:
        return /Id="CFe(\d{44})"/;
    }
    return null;
  }

  private async checkIfCancelled(): Promise<boolean> {
    if (this.isCancelled) {
      if (this.cancelledMessage === null) {
        this.cancelledMessage = "Tarefa de contagem de notas foi cancelada.";
        await this.sendMessageClient(
          [this.cancelledMessage],
          0,
          ProcessamentoStatus.Stopped
        );
      }
      return true;
    }
    return false;
  }

  private async checkIfPaused(): Promise<boolean> {
    if (this.isPaused) {
      if (this.pausedMessage === null) {
        this.pausedMessage = "Tarefa de contagem de notas foi pausada.";
        await this.sendMessageClient(
          [this.pausedMessage],
          0,
          ProcessamentoStatus.Paused
        );
      }
      return true;
    }
    return false;
  }

  private async countNotesPerCompany() {
    this.countNotes = await getCountNotes(this.config?.apiKeySieg!, {
      DataEmissaoInicio: format(this.dateInitial!, "yyyy-MM-dd"),
      DataEmissaoFim: format(this.dateEnd!, "yyyy-MM-dd"),
    });

    const countedNotesDb = await getCountedNotes(
      this.dateInitial!,
      this.dateEnd!
    );

    if (countedNotesDb) {
      if (
        countedNotesDb.nfe === this.countNotes.NFe &&
        countedNotesDb.nfce === this.countNotes.NFCe &&
        countedNotesDb.cte === this.countNotes.CTe &&
        countedNotesDb.cfe === this.countNotes.CFe &&
        countedNotesDb.nfse === this.countNotes.NFSe
      ) {
        await this.sendMessageClient(
          [
            `Foram encontradas ${this.countNotes.NFe} NFe | ${this.countNotes.NFCe} NFCe | ${this.countNotes.CTe} CTe | ${this.countNotes.CFe} CFe | ${this.countNotes.NFSe} NFSe`,
          ],
          0,
          ProcessamentoStatus.Running
        );
        return;
      } else {
        await updateCountedNotes({
          id: countedNotesDb.id,
          dataInicio: this.dateInitial!,
          dataFim: this.dateEnd!,
          nfe: this.countNotes.NFe,
          nfce: this.countNotes.NFCe,
          cte: this.countNotes.CTe,
          cfe: this.countNotes.CFe,
          nfse: this.countNotes.NFSe,
          role: RoleTypeSieg.Emit,
        });
      }
    } else {
      await addCountedNotes({
        dataInicio: this.dateInitial!,
        dataFim: this.dateEnd!,
        nfe: this.countNotes.NFe,
        nfce: this.countNotes.NFCe,
        cte: this.countNotes.CTe,
        cfe: this.countNotes.CFe,
        nfse: this.countNotes.NFSe,
        role: RoleTypeSieg.Emit,
      });
    }

    await this.sendMessageClient(
      [
        `Foram encontradas ${this.countNotes.NFe} NFe | ${this.countNotes.NFCe} NFCe | ${this.countNotes.CTe} CTe | ${this.countNotes.CFe} CFe | ${this.countNotes.NFSe} NFSe`,
      ],
      0,
      ProcessamentoStatus.Running
    );
  }

  private initializeProperties(connection: connection) {
    this.isCancelled = false;
    this.cancelledMessage = null;
    this.isPaused = false;
    this.pausedMessage = null;
    this.connection = connection;
    this.empresas = [];
    this.config = null;
    this.dateInitial = null;
    this.dateEnd = null;
    this.countNotes = { NFe: 0, NFCe: 0, CTe: 0, CFe: 0, NFSe: 0 };
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    status = ProcessamentoStatus.Running
  ) {
    await timeout();
    console.log("🔍 messages: ", messages);
    messages.forEach((x) => this.historic.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      await addHistoric(this.historic);
    }
    this.connection?.sendUTF(
      JSON.stringify({
        type: "message",
        message: {
          type: WSMessageType.Sieg,
          data: {
            messages,
            progress,
            status,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );
    await timeout(5);
  }
}

function timeout(time?: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time ?? 50);
  });
}
