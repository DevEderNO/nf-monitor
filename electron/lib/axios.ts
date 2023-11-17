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
});

export async function signIn(
  user: string,
  password: string,
  useCryptography?: boolean
): Promise<ISignIn> {
  const currentPassword = useCryptography ? decrypt(password) : password;
  const resp = await apiAuth.get<ISignIn>(`auth/logar-nfe-monitor`, {
    params: {
      usuario: user,
      senha: currentPassword,
    },
    headers: {
      Origin: "http://app.sittax.com.br",
    },
  });
  return resp.data;
}

export async function upload(token: string, filepath: string) {
  const form = new FormData();
  form.append("arquivo", createReadStream(filepath));
  await api.post("upload/importar-arquivo", form, {
    headers: {
      ...form.getHeaders,
      Authorization: `Bearer ${token}`,
      Origin: "http://app.sittax.com.br",
    },
  });
}
