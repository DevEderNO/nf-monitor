import React, { useMemo } from 'react';
import { Button } from '../ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { SunDim, Moon, LogOut } from 'lucide-react';
import { Separator } from '@components/ui/separator';
import { useTheme } from '@hooks/theme';
import { useAuth } from '@hooks/auth';
import logoMonitor from '@images/logo-monitor.png';
import grafismo from '@images/grafismo.png';
import packageJson from '../../../package.json';

const Menu: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuItems = useMemo(
    () => [
      {
        label: 'Envio de Notas',
        selected: location.pathname === '/invoices',
        onClick: () => {
          navigate('/invoices', {
            replace: true,
            state: { from: location },
          });
        },
        visible: true,
      },
      {
        label: 'Envio de Documentos',
        selected: location.pathname === '/certificates',
        onClick: () => {
          navigate('/certificates', {
            replace: true,
            state: { from: location },
          });
        },
        visible: true,
      },
      {
        label: 'Selecionar Diretórios',
        selected: location.pathname === '/directories',
        onClick: () => {
          navigate('/directories', {
            replace: true,
            state: { from: location },
          });
        },
        visible: true,
      },
      {
        label: 'Configurações',
        selected: location.pathname === '/configuration',
        onClick: () => {
          navigate('/configuration', {
            replace: true,
            state: { from: location },
          });
        },
        visible: true,
      },
    ],
    [location, navigate]
  );

  return (
    <div className="flex p-3 w-full justify-between h-fit">
      <div className="flex gap-3.5 items-baseline mb-3">
        <img src={logoMonitor} alt="logo" className="rounded-md object-cover h-7" />
        <Separator orientation="vertical" className="h-7" />
        <div className="flex items-center h-7">
          {menuItems.filter(x => x.visible).map((item, index) => menuItemRender(item, index))}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground font-semibold">v{packageJson.version}</span>
        <Button variant="outline" size="icon" onClick={() => (theme === 'dark' ? setTheme('light') : setTheme('dark'))}>
          {theme === 'dark' ? <SunDim /> : <Moon />}
        </Button>
        <Button size="icon" variant={'secondary'} onClick={signOut}>
          <LogOut />
        </Button>
      </div>
    </div>
  );
};

function menuItemRender(
  {
    label,
    selected,
    onClick,
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
  },
  key: string | number
) {
  return (
    <Button key={key} variant={'link'} className="flex gap-1 items-center px-2" onClick={onClick}>
      {selected ? (
        <img src={grafismo} alt="logo" className="rounded-md object-cover h-5 rotate-180" />
      ) : (
        <div className="h-5 w-2"></div>
      )}
      {label}
      {selected ? (
        <img src={grafismo} alt="logo" className="rounded-md object-cover h-5" />
      ) : (
        <div className="h-5 w-2"></div>
      )}
    </Button>
  );
}

export default Menu;
