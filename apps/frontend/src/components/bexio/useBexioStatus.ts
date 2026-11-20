import {
  isBexioNotConfigured,
  useGetBexioAccountsQuery,
} from "@/store/slices/api";

/**
 * bexio est-il joignable ? `undefined` pendant la première lecture. Lu sur
 * le plan comptable (409 : `BEXIO_API_TOKEN` absent).
 */
export function useBexioStatus(): {
  connected: boolean | undefined;
  notConfigured: boolean;
} {
  const { data, error, isLoading } = useGetBexioAccountsQuery();
  return {
    connected: isLoading ? undefined : !!data && !error,
    notConfigured: isBexioNotConfigured(error),
  };
}
