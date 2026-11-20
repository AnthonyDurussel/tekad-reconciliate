import { defineMock } from "vite-plugin-mock-dev-server";
import {
  currentToken,
  extractRoles,
  extractedRoles,
  getLoggedToken,
} from "../token";

export default defineMock({
  url: "/.auth/login/aad",
  response: async (req, res) => {
    extractedRoles.value = await extractRoles();
    currentToken.value = getLoggedToken();
    const url = new URL(req.url ?? "/", "http://localhost");
    const target = url.searchParams.get("post_login_redirect_uri") || "/";
    res.writeHead(302, { Location: target });
    res.end();
  },
});
