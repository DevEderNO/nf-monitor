import axios from "axios";

export const apiAuth = axios.create({
  baseURL: "http://localhost:6022/api/",
});
