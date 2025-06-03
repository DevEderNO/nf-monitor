import axios from "axios";
import { createReadStream } from "fs";
import FormData from "form-data";
import { ISignIn } from "../interfaces/signin";
import {
  ISiegCountNotesRequest,
  ISiegDownloadNotesRequest,
  ISiegDownloadNotesResponse,
} from "../interfaces/sieg";
import { BrowserWindow } from "electron";
import { NFMoniotorHealth } from "../interfaces/health-message";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const apiAuth = axios.create({
  baseURL: process.env.VITE_API_AUTH_URL,
});

const api = axios.create({
  baseURL: process.env.VITE_API_UPLOAD_URL,
  timeout: 20000,
});

const apiSieg = axios.create({
  baseURL: process.env.VITE_API_SIEG_URL,
  timeout: 50000,
});

const apiHealthBroker = axios.create({
  baseURL: process.env.VITE_API_HEALTH_BROKER_URL,
  timeout: 20000,
});

export async function checkRoute(url: string) {
  try {
    await axios.head(url);
    return true;
  } catch (error) {
    return false;
  }
}

export async function signIn(
  username: string,
  password: string,
): Promise<ISignIn> {
  const resp = await apiAuth.get<ISignIn>(`auth/logar-nfe-monitor`, {
    params: {
      usuario: username,
      senha: password,
    },
    headers: {
      Origin: "https://app.sittax.com.br",
    },
  });
  return resp.data;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function retry(
  url: string,
  filepath: string,
  token: string,
  maximumRetry = 0,
  attempt = 0,
  delay = 0,
) {
  try {
    await sleep(delay);
    const form = new FormData();
    form.append("arquivo", createReadStream(filepath));
    const { data } = await api.post(url, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "http://app.sittax.com.br",
      },
    });
    form.destroy();
    if (data) return data;
    throw new Error("Nenhuma resposta da API");
  } catch (e) {
    if (attempt >= maximumRetry) throw e;
    return retry(
      url,
      filepath,
      token,
      maximumRetry,
      attempt + 1,
      (delay || 500) * 2,
    );
  }
}

export async function upload(token: string, filepath: string) {
  await retry("upload/importar-arquivo", filepath, token, 5);
}

export async function retrySieg(
  url: string,
  apiKey: string,
  data: ISiegCountNotesRequest | ISiegDownloadNotesRequest,
  maximumRetry = 0,
  attempt = 0,
  delay = 0,
) {
  try {
    await sleep(delay);
    const resp = await apiSieg.post(url, data, {
      params: {
        api_key: apiKey,
      },
      headers: {
        Origin: "http://app.sittax.com.br",
      },
    });
    if (resp.data) return resp.data;
    throw new Error("Nenhuma resposta da API");
  } catch (e) {
    if (attempt >= maximumRetry) throw e;
    console.info(
      "Erro ao baixar notas numero de tentativas: ",
      attempt,
      "delay: ",
      delay,
    );
    return retrySieg(
      url,
      apiKey,
      data,
      maximumRetry,
      attempt + 1,
      (delay > 0 ? delay : 1000) * 2,
    );
  }
}

export async function getCountNotes(
  apiKey: string,
  data: ISiegCountNotesRequest,
) {
  return await retrySieg(`/ContarXmls`, apiKey, data, 5);
}

export async function downloadNotes(
  apiKey: string,
  data: ISiegDownloadNotesRequest,
): Promise<ISiegDownloadNotesResponse> {
  return await retrySieg(`/BaixarXmlsV2`, apiKey, data, 10);
}

export async function healthBrokerSetHealf(message: NFMoniotorHealth) {
  try {
    console.info("Enviando mensagem para o Health Broker", message);
    await apiHealthBroker.post("set-health", message);
  } catch (error) {
    console.error("Erro ao enviar mensagem para o Health Broker", error);
  }
}

api.interceptors.request.use((config) => {
  return config;
});

apiAuth.interceptors.request.use((config) => {
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx triggers this function
    return response;
  },
  (error) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(
        "main-process-message",
        `error: ${JSON.stringify(error)}`,
      );
    });
    return Promise.reject(error);
  },
);

// Response interceptor
apiAuth.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx triggers this function
    return response;
  },
  (error) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(
        "main-process-message",
        `error: ${JSON.stringify(error)}`,
      );
    });
    return Promise.reject(error);
  },
);

apiSieg.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(
        "main-process-message",
        `error: ${JSON.stringify(error)}`,
      );
    });
    return Promise.reject(error);
  },
);
