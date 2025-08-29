import { useAppState } from "@hooks/state";
import { Outlet } from "react-router-dom";
import Menu from "../Menu";

export function Layout() {
  const { state } = useAppState();
  return state?.auth?.token?.length > 0 ? (
    <div className="flex flex-col h-full w-full">
      <Menu />
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  ) : (
    <Outlet />
  );
}
