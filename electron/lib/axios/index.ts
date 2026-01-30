import axios, { AxiosError } from 'axios';
import { decrypt } from '../cryptography';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import { ISignIn } from '../../interfaces/signin';
import { handleAxiosError } from './error-handle';

// Desabilitar verificação SSL apenas em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const apiAuth = axios.create({
  baseURL: import.meta.env.VITE_API_AUTH_URL,
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_UPLOAD_URL,
  timeout: 300000, // 5 minutos
  maxContentLength: 1000 * 1024 * 1024, // 1GB
  maxBodyLength: 1000 * 1024 * 1024, // 1GB
});

const webApi = axios.create({
  baseURL: import.meta.env.VITE_WEB_API_URL,
  timeout: 300000, // 5 minutos
  maxContentLength: 1000 * 1024 * 1024, // 1GB
  maxBodyLength: 1000 * 1024 * 1024, // 1GB
});

export async function signIn(username: string, password: string, useCryptography?: boolean): Promise<ISignIn> {
  try {
    const currentPassword = useCryptography ? decrypt(password) : password;
    const resp = await apiAuth.get<ISignIn>(`auth/logar-nfe-monitor`, {
      params: {
        usuario: username,
        senha: currentPassword,
      },
      headers: {
        Origin: 'https://app.sittax.com.br',
      },
    });
    return resp.data;
  } catch (error) {
    throw handleAxiosError(error as AxiosError);
  }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function retry(url: string, filepath: string, token: string, maximumRetry = 0, attempt = 0, delay = 0) {
  try {
    await sleep(delay);
    const form = new FormData();
    form.append('arquivo', createReadStream(filepath));
    const { data } = await api.post(url, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://app.sittax.com.br',
      },
    });
    form.destroy();
    if (data) return data;
    throw new Error('Nenhuma resposta da API');
  } catch (e) {
    if (attempt >= maximumRetry) {
      throw handleAxiosError(e as AxiosError);
    }
    return retry(url, filepath, token, maximumRetry, attempt + 1, (delay || 500) * 2);
  }
}

export async function retryCertificate(
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
    form.append('arquivo', createReadStream(filepath));
    const { data } = await webApi.post(url, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://app.sittax.com.br',
      },
    });
    form.destroy();
    if (data) return data;
    throw new Error('Nenhuma resposta da API');
  } catch (e) {
    if (attempt >= maximumRetry) {
      throw handleAxiosError(e as AxiosError);
    }
    return retryCertificate(url, filepath, token, maximumRetry, attempt + 1, (delay || 500) * 2);
  }
}

export async function upload(token: string, filepath: string, invoices: boolean) {
  if (invoices) await retry('upload/importar-arquivo', filepath, token, 5);
  else await retryCertificate('v2/nova-implantacao/importar-arquivo', filepath, token, 5);
}

export async function uploadBatch(
  token: string,
  filepaths: string[],
  maximumRetry = 5,
  attempt = 0,
  delay = 0
): Promise<void> {
  try {
    await sleep(delay);
    const form = new FormData();
    for (const filepath of filepaths) {
      form.append('arquivos', createReadStream(filepath));
    }
    const { data } = await api.post('upload/importar-arquivos', form, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'http://app.sittax.com.br',
      },
    });
    form.destroy();
    if (data) return data;
    throw new Error('Nenhuma resposta da API');
  } catch (e) {
    if (attempt >= maximumRetry) {
      throw handleAxiosError(e as AxiosError);
    }
    return uploadBatch(token, filepaths, maximumRetry, attempt + 1, (delay || 500) * 2);
  }
}
