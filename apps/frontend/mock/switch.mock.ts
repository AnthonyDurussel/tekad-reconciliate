import { defineMock } from "vite-plugin-mock-dev-server";
import { currentUserIndex, DEV_ACCOUNTS } from "./token";

/** Choix du compte de dev avant `/.auth/login/aad`. */
export default defineMock([
  {
    url: "/.auth/accounts",
    body: () => DEV_ACCOUNTS,
  },
  {
    url: "/.auth/switch/:id",
    body: (request) => {
      currentUserIndex.value = Number(request.params.id) || 0;
      return { status: "success" };
    },
  },
]);
