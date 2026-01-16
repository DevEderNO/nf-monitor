import { useAppState } from '@hooks/state';
import { Outlet } from 'react-router-dom';
import Menu from '../Menu';

export function Layout() {
  const { state } = useAppState();
  const isHomolog = import.meta.env.VITE_API_UPLOAD_URL?.includes("homolog");
    console.log('VITE_API_UPLOAD_URL:', import.meta.env.VITE_API_UPLOAD_URL);

  return state?.auth?.token?.length > 0 ? (
    <div className="flex flex-col h-full w-full">
      {isHomolog ? <p className="w-full bg-red-500 text-center font-bold text-white">VERSÃO DE HOMOLOGAÇÃO</p> : <></>}
      <Menu />
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  ) : (
    <Outlet />
  );
}
