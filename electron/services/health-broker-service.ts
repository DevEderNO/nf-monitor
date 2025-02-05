import { app } from "electron";
import { HealthErrorMessage } from "../interfaces/health-error-message";
import { countFilesSendedToDay, getUser } from "./database";
import {
  getDiskInfo,
  getNetworkInterfaces,
  getSystemInfo,
} from "./os-info-services";
import { healthBrokerSetHealf } from "../lib/axios";

export async function healthBrokerComunication() {
  const user = await getUser();
  const filesSendedToDay = await countFilesSendedToDay();
  const message: HealthErrorMessage = {
    $type: "HealthMessageWindows",
    source: 1,
    childrens: [
      {
        $type: "HealthMessageWindowsUsuario",
        id: user?.userId ?? "",
        name: user?.nome ?? "",
        email: user?.email ?? "",
      },
      { ...(await getSystemInfo()) },
      ...getDiskInfo(),
      ...getNetworkInterfaces(),
      {
        $type: "HealthMessageWindowsProgram",
        name: app.getName(),
        folder: app.getAppPath().replace(/\\/g, "/"),
      },
    ],
    escritorio: "27379587000148 - FERRARI SERVICOS CONTABEIS LTDA",
    message: `Arquivos enviados hoje ${filesSendedToDay}`,
  };
  await healthBrokerSetHealf(message);
}
