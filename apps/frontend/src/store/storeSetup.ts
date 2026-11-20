import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  type PersistConfig,
} from "redux-persist";
import storage from "redux-persist/es/storage";
import { setupListeners } from "@reduxjs/toolkit/query";
import { PERSIST_STORE_NAME } from "@/constants/app.constant";
import rootReducer, { type RootState } from "./rootReducer";
import { baseApi } from "./slices/api/baseApi";
import { apiErrorNotificationMiddleware } from "./middleware/apiErrorNotificationMiddleware";
import { sessionExpirationMiddleware } from "./middleware/sessionExpirationMiddleware";

/** Seul `auth` est persisté : le cache RTK Query se reconstruit au chargement. */
const persistConfig: PersistConfig<RootState> = {
  key: PERSIST_STORE_NAME,
  keyPrefix: "",
  storage,
  whitelist: ["auth"],
};

const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(baseApi.middleware)
      .concat(sessionExpirationMiddleware)
      .concat(apiErrorNotificationMiddleware),
  devTools: import.meta.env.DEV,
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);

export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;

export default store;
