import { combineReducers } from "@reduxjs/toolkit";
import auth from "./slices/auth";
import { baseApi } from "./slices/api/baseApi";

export const staticRootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth,
});

export type RootState = ReturnType<typeof staticRootReducer>;

export default staticRootReducer;
