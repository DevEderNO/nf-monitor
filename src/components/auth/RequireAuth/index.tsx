import { useAppState } from "@hooks/state";
import { Navigate, useLocation } from "react-router-dom";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { state } = useAppState();
  const location = useLocation();

  if (state?.auth?.token?.length <= 0) {
    return <Navigate to={"/"} state={{ from: location }} replace />;
  }

  return children;
}
