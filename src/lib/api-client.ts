import axios from "axios";

export const apiClient = axios.create({
  baseURL: "https://api.coincap.io/v2",
});
