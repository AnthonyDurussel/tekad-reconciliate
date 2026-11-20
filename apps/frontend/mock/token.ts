import { defineMockData } from "vite-plugin-mock-dev-server";

/**
 * Comptes de développement servis par le faux `/.auth` (Azure Static Web
 * Apps). Le compte choisi sur la page de connexion devient le principal
 * transmis à l'API (`x-ms-client-principal`) par le proxy de `vite.config.ts`.
 */
type MockClaim = { typ: string; val: string };

type MockClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: MockClaim[];
};

export type MockToken = { clientPrincipal: MockClientPrincipal | null };

export const DEV_ACCOUNTS = [
  { email: "admin@tekad.dev", name: "Admin Tekad", role: "ADMIN" },
  {
    email: "comptable@tekad.dev",
    name: "Comptable (fiduciaire)",
    role: "ACCOUNTANT",
  },
  { email: "lecture@tekad.dev", name: "Lecture seule", role: "VIEWER" },
];

const syntheticToken = (index: number): MockToken => {
  const account = DEV_ACCOUNTS[index] ?? DEV_ACCOUNTS[0];
  return {
    clientPrincipal: {
      identityProvider: "aad",
      userId: `dev-${index}`,
      userDetails: account.email,
      userRoles: [],
      claims: [
        { typ: "name", val: account.name },
        { typ: "preferred_username", val: account.email },
      ],
    },
  };
};

export const currentToken = defineMockData<MockToken>("token", {
  clientPrincipal: null,
});
export const currentUserIndex = defineMockData<number>("userIndex", 0);
export const extractedRoles = defineMockData<string[]>("extractedRoles", []);

export const getLoggedToken = (): MockToken => {
  const token = syntheticToken(Number(currentUserIndex.value) || 0);
  token.clientPrincipal!.userRoles = extractedRoles.value;
  return token;
};

/**
 * Rôles du compte, comme le ferait `rolesSource` de Static Web Apps : l'API
 * réelle (`POST /api/roles`).
 */
export async function extractRoles(): Promise<string[]> {
  const principal = getLoggedToken().clientPrincipal;
  try {
    const api = process.env.API_TARGET ?? "http://localhost:7071";
    const response = await fetch(`${api}/api/roles`, {
      method: "POST",
      body: JSON.stringify(principal),
    });
    if (response.status !== 200) return [];
    const data = await response.json();
    return data?.roles ?? [];
  } catch (error) {
    console.error("Error extracting roles:", error);
    return [];
  }
}
