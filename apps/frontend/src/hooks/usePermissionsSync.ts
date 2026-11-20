import { useEffect } from "react";
import { setPermissions, useAppDispatch, useAppSelector } from "@/store";
import { useGetMeQuery } from "@/store/slices/api";

/**
 * Recharge `users/me` à chaque montage de `ProtectedRoute` : un changement de
 * rôle prend effet au rechargement suivant. Rend `true` tant que les
 * permissions n'ont jamais été connues.
 */
export function usePermissionsSync(enabled: boolean): boolean {
  const dispatch = useAppDispatch();
  const known = useAppSelector((s) => s.auth.user.permissions !== undefined);
  const { data, isError } = useGetMeQuery(undefined, {
    skip: !enabled,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (data) {
      dispatch(
        setPermissions({
          permissions: data.permissions,
          role: data.role,
          name: data.name,
        }),
      );
    }
  }, [data, dispatch]);

  return enabled && !known && !isError;
}
