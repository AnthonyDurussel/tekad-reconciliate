import { describe, expect, it } from "vitest";
import { signOutUrl } from "./signOutUrl";

const TENANT = "11111111-2222-3333-4444-555555555555";
const CLIENT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const entraUrl = (url: string) => {
  const [path, query] = url.split("?");
  expect(path).toBe("/.auth/logout");
  return new URL(
    new URLSearchParams(query).get("post_logout_redirect_uri") ?? "",
  );
};

describe("signOutUrl", () => {
  it("ferme la session Entra du compte avec logout_hint", () => {
    const url = entraUrl(
      signOutUrl(
        [
          {
            typ: "http://schemas.microsoft.com/identity/claims/tenantid",
            val: TENANT,
          },
          { typ: "aud", val: CLIENT },
          { typ: "login_hint", val: "O.CiQ…hint" },
        ],
        "https://risques.dransenergie.ch",
        "/public/log-in",
      ),
    );
    expect(url.origin + url.pathname).toBe(
      `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/logout`,
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://risques.dransenergie.ch/public/log-in",
    );
    expect(url.searchParams.get("client_id")).toBe(CLIENT);
    expect(url.searchParams.get("logout_hint")).toBe("O.CiQ…hint");
  });

  it("prend le tenant de l'émetteur, sans hint ni client inventés", () => {
    const url = entraUrl(
      signOutUrl(
        [
          {
            typ: "iss",
            val: `https://login.microsoftonline.com/${TENANT}/v2.0`,
          },
        ],
        "https://x.ch",
        "/public/log-in",
      ),
    );
    expect(url.pathname).toBe(`/${TENANT}/oauth2/v2.0/logout`);
    expect(url.searchParams.has("logout_hint")).toBe(false);
    expect(url.searchParams.has("client_id")).toBe(false);
  });

  it("sans claims : endpoint organizations", () => {
    expect(entraUrl(signOutUrl(undefined, "https://x.ch", "/l")).pathname).toBe(
      "/organizations/oauth2/v2.0/logout",
    );
  });
});
