import axios from "axios";

export const apiAuth = axios.create({
  baseURL: import.meta.env.VITE_API_AUTH_URL,
});

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_UPLOAD_URL,
});
