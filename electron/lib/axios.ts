import axios from "axios";
import { decrypt } from "./cryptography";
import { createReadStream } from "fs";
import FormData from "form-data";
import { ISignIn } from "../interfaces/signin";

const apiAuth = axios.create({
  baseURL: import.meta.env.VITE_API_AUTH_URL,
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_UPLOAD_URL,
  timeout: 20000,
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
    console.log("Enviando o arquivo ", filepath, " para o Sittax pelo retry");
    const { data } = await api.post(url, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "http://app.sittax.com.br",
      },
    });

    return data;
  } catch (e) {
    console.log("Erro ao enviar o arquivo no retry: ", e);
    if (attempt >= maximumRetry) throw e;
    return retry(url, filepath, token, attempt + 1, (delay || 1000) * 2);
  }
}

export async function upload(token: string, filepath: string) {
  const form = new FormData();
  form.append("arquivo", createReadStream(filepath));
  await retry("upload/importar-arquivo", filepath, token, 5, 0, 0);
}
