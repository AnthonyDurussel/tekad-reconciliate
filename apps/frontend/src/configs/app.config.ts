export type AppConfig = {
  apiPrefix: string;
  authenticatedEntryPath: string;
  unAuthenticatedEntryPath: string;
  loginUrl: string;
  logoutUrl: string;
  locale: string;
};

const appConfig: AppConfig = {
  apiPrefix: "/api",
  authenticatedEntryPath: "/dashboard",
  unAuthenticatedEntryPath: "/public/log-in",
  loginUrl: "/.auth/login/aad",
  logoutUrl: "/.auth/logout",
  locale: "fr",
};

export default appConfig;
