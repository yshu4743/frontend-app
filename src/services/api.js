import axios from "axios";

const API = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const parserAPI = {
  parseWhatsApp: (rawText) => API.post("/parser/whatsapp", { rawText }),
};

export const shopAPI = {
  getAllShops: () => API.get("/shops"),
  createShop: (shopData) => API.post("/shops", shopData),
  importShops: (shops) => API.post("/shops/import", { shops }),
  getShopById: (id) => API.get(`/shops/${id}`),
};

export const pricingAPI = {
  calculate: (items) => API.post("/pricing/calculate", { items }),
};

export const rateSheetAPI = {
  dispatch: (data) => API.post("/rates/dispatch", data),
  getAll: () => API.get("/rates"),
  getById: (id) => API.get(`/rates/${id}`),
};

export default API;
