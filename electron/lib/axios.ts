import axios from "axios";

export const apiAuth = axios.create({
  baseURL: "http://localhost:6022",
});

export const api = axios.create({
  baseURL: "https://upload.sittax.com.br/api/",
});
