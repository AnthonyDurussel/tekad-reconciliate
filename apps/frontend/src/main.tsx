import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import App from "./App";
import store from "@/store";
import "./locales";
import "./global.css";

dayjs.locale("fr");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
