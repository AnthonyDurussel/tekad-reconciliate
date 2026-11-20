import { render as testingLibraryRender } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { theme } from "../src/theme";
import "../src/locales";
import { staticRootReducer } from "../src/store/rootReducer";
import { baseApi } from "../src/store/slices/api/baseApi";

export function render(ui: React.ReactNode) {
  return testingLibraryRender(<>{ui}</>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider theme={theme}>{children}</MantineProvider>
    ),
  });
}

/** Rendu avec un store neuf (état préchargé possible) et un routeur mémoire. */
export function renderWithProviders(
  ui: React.ReactNode,
  {
    preloadedState,
    route = "/",
  }: { preloadedState?: any; route?: string } = {},
) {
  const store = configureStore({
    reducer: staticRootReducer,
    preloadedState,
    middleware: (gdm) =>
      gdm({ serializableCheck: false, immutableCheck: false }).concat(
        baseApi.middleware,
      ),
  });
  const result = testingLibraryRender(<>{ui}</>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>
        <MantineProvider theme={theme}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </MantineProvider>
      </Provider>
    ),
  });
  return { store, ...result };
}
