import { app } from "electron";
import { NFMoniotorHealth, XHealthType } from "../interfaces/health-message";
import { countFilesSendedToDay, getUser } from "./database";
import {
  getDiskInfo,
  getNetworkInterfaces,
  getSystemInfo,
} from "./os-info-services";
import { healthBrokerSetHealf } from "../lib/axios";
import os from "node:os";

export async function healthBrokerComunication() {
  const user = await getUser();
  if (!user?.userId) return;
  const filesSendedToDay = await countFilesSendedToDay();
  const message: NFMoniotorHealth = {
    $type: "NFMoniotorHealth",
    source: 1,
    type: XHealthType.Info,
    data: new Date(),
    childrens: [
      {
        $type: "NFMoniotorHealthUsuario",
        id: user?.userId ?? "",
        name: user?.nome ?? "",
        email: user?.email ?? "",
      },
      { ...(await getSystemInfo()) },
      ...getDiskInfo(),
      ...getNetworkInterfaces(),
      {
        $type: "NFMoniotorHealthProgram",
        name: app.getName(),
        folder: app.getAppPath().replace(/\\/g, "/"),
      },
    ],
    escritorio: "",
    usuario: user?.userId ?? "",
    maquina: os.hostname(),
    message: `Arquivos enviados hoje ${filesSendedToDay}`,
  };
  await healthBrokerSetHealf(message);
}
