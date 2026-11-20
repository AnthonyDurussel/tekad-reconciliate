import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { protectedRoutes, publicRoutes } from "@/configs/routes.config";
import ProtectedRoute from "@/route/ProtectedRoute";
import PublicRoute from "@/route/PublicRoute";
import AuthorityGuard from "@/route/AuthorityGuard";
import HomeRedirect from "@/route/HomeRedirect";
import LoadingScreen from "@/components/loading/LoadingScreen";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";

export default function Views() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<HomeRedirect />} />
            {protectedRoutes.map((route) => (
              <Route
                key={route.key}
                path={route.path}
                element={
                  <AuthorityGuard permissions={route.permissions}>
                    <route.component />
                  </AuthorityGuard>
                }
              />
            ))}
            <Route path="*" element={<Navigate replace to="/" />} />
          </Route>
          <Route path="/" element={<PublicRoute />}>
            {publicRoutes.map((route) => (
              <Route
                key={route.key}
                path={route.path}
                element={<route.component />}
              />
            ))}
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
