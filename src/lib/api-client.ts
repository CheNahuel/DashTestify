import axios from "axios";

export const apiClient = axios.create({
  baseURL: "https://rest.coincap.io/v3",
  headers: {
    Authorization: `Bearer ${process.env.COINCAP_API_KEY ?? ""}`,
  },
});
