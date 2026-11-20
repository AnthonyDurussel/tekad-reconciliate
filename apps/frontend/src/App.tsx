import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { DatesProvider } from "@mantine/dates";
import { useTranslation } from "react-i18next";
import "dayjs/locale/en";
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter } from "react-router-dom";
import { persistor } from "./store";
import { theme } from "./theme";
import RootLayout from "./root/RootLayout";
import LoadingScreen from "./components/loading/LoadingScreen";
import { LoadingCurtainHost } from "./components/loading/LoadingCurtainHost";

export default function App() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? "en" : "fr";
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale, firstDayOfWeek: 1 }}>
        <Notifications position="top-right" zIndex={1000} />
        <ModalsProvider>
          <PersistGate loading={<LoadingScreen />} persistor={persistor}>
            <BrowserRouter>
              <RootLayout />
            </BrowserRouter>
          </PersistGate>
        </ModalsProvider>
        <LoadingCurtainHost />
      </DatesProvider>
    </MantineProvider>
  );
}
