import type { HttpResponseInit } from "@azure/functions";

export const ok = (body: unknown): HttpResponseInit => ({
  status: 200,
  jsonBody: body,
});

export const created = (body: unknown): HttpResponseInit => ({
  status: 201,
  jsonBody: body,
});

export const noContent = (): HttpResponseInit => ({ status: 204 });
