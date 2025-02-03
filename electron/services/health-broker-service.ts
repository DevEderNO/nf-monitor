import { app } from "electron";
import { HealthErrorMessage } from "../interfaces/health-error-message";
import { countFilesSendedToDay, getUser } from "./database";
import { getSystemInfo } from "./os-info-services";
import { healthBrokerSetHealf } from "../lib/axios";

export async function healthBrokerComunication() {
  const user = await getUser();
  const filesSendedToDay = await countFilesSendedToDay();
  const message: HealthErrorMessage = {
    $type: "HealthErrorMessage",
    source: 1,
    usuario: JSON.stringify({
      id: user?.userId,
      name: user?.nome,
      email: user?.email,
    }),
    maquina: JSON.stringify(await getSystemInfo()),
    escritorio: "27379587000148 - FERRARI SERVICOS CONTABEIS LTDA",
    programa: JSON.stringify({
      name: app.getName(),
      folder: app.getAppPath().replace(/\\/g, "/"),
    }),
    message: `Arquivos enviados hoje ${filesSendedToDay}`,
  };
  await healthBrokerSetHealf(message);
}
