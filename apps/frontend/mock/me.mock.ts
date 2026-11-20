import { defineMock } from "vite-plugin-mock-dev-server";
import { currentToken } from "./token";

export default defineMock({
  url: "/.auth/me",
  body: () => currentToken.value,
});
