import { useAppState } from "@hooks/state";
import { Outlet, useLocation } from "react-router-dom";
import Menu from "../Menu";
import { SittaxWebview } from "../SittaxWebview";

export function Layout() {
  const { state } = useAppState();
  const location = useLocation();
  const isSittaxRoute = location.pathname === '/sittax';

  return state?.auth?.token?.length > 0 ? (
    <div className="flex flex-col h-full w-full bg-background">
      <Menu />
      <div
        className="flex-1 min-h-0 container max-w-6xl mx-auto py-8 px-6"
        style={{ display: isSittaxRoute ? 'none' : undefined }}
      >
        <Outlet />
      </div>
      <SittaxWebview visible={isSittaxRoute} />
    </div>
  ) : (
    <Outlet />
  );
}
