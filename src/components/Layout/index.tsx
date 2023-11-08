import { useAppState } from "@hooks/state";
import { Outlet } from "react-router-dom";
import Menu from "../Menu";

export function Layout() {
  const { state } = useAppState();
  return state?.auth?.token?.length > 0 ? (
    <div className="flex flex-col min-h-full w-full">
      <Menu />
      <Outlet />
    </div>
  ) : (
    <Outlet />
  );
}
