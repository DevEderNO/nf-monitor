import axios from "axios";

export const apiAuth = axios.create({
  baseURL: process.env.API_AUTH_URL,
});

export const api = axios.create({
  baseURL: process.env.API_UPLOAD_URL,
});
