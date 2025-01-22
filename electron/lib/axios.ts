import axios from "axios";
import { decrypt } from "./cryptography";
import { createReadStream } from "fs";
import FormData from "form-data";
import { ISignIn } from "../interfaces/signin";
import {
  ISiegCountNotesRequest,
  ISiegDownloadNotesRequest,
  ISiegDownloadNotesResponse,
} from "../interfaces/sieg";

const apiAuth = axios.create({
  baseURL: import.meta.env.VITE_API_AUTH_URL,
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_UPLOAD_URL,
  timeout: 20000,
});

const apiSieg = axios.create({
  baseURL: import.meta.env.VITE_API_SIEG_URL,
  timeout: 50000,
});

export async function signIn(
  username: string,
  password: string,
  useCryptography?: boolean
): Promise<ISignIn> {
  const currentPassword = useCryptography ? decrypt(password) : password;
  const resp = await apiAuth.get<ISignIn>(`auth/logar-nfe-monitor`, {
    params: {
      usuario: username,
      senha: currentPassword,
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
  delay = 0
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

    return data;
  } catch (e) {
    if (attempt >= maximumRetry) throw e;
    return retry(
      url,
      filepath,
      token,
      maximumRetry,
      attempt + 1,
      (delay || 1000) * 2
    );
  }
}

export async function upload(token: string, filepath: string) {
  const form = new FormData();
  form.append("arquivo", createReadStream(filepath));
  await retry("upload/importar-arquivo", filepath, token, 5);
}

export async function retrySieg(
  url: string,
  apiKey: string,
  data: ISiegCountNotesRequest,
  maximumRetry = 0,
  attempt = 0,
  delay = 0
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

    return resp.data;
  } catch (e) {
    if (attempt >= maximumRetry) throw e;
    console.log("Erro ao baixar notas numero de tentativas: ", attempt);
    return retrySieg(
      url,
      apiKey,
      data,
      maximumRetry,
      attempt + 1,
      (delay || 1000) * 2
    );
  }
}

export async function getCountNotes(
  apiKey: string,
  data: ISiegCountNotesRequest
) {
  const response = await retrySieg(`/ContarXmls`, apiKey, data, 5);
  return response;
}

export async function downloadNotes(
  apiKey: string,
  data: ISiegDownloadNotesRequest
): Promise<ISiegDownloadNotesResponse> {
  const response = await retrySieg(`/BaixarXmlsV2`, apiKey, data, 5);
  return response;
}
