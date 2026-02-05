import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { SunDim, Moon, LogOut } from 'lucide-react';
import { Separator } from '@components/ui/separator';
import { useTheme } from '@hooks/theme';
import { useAuth } from '@hooks/auth';
import logoMonitor from '@images/logo-monitor.png';
import grafismo from '@images/grafismo.png';
import packageJson from '../../../package.json';

const SITTAX_UNLOCK_KEY = 'sittax-unlocked';

const Menu: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [sittaxUnlocked, setSittaxUnlocked] = useState(() => {
    return localStorage.getItem(SITTAX_UNLOCK_KEY) === 'true';
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem(SITTAX_UNLOCK_KEY, String(sittaxUnlocked));
  }, [sittaxUnlocked]);

  useEffect(() => {
    if (!sittaxUnlocked && location.pathname === '/sittax') {
      navigate('/invoices', { replace: true });
    }
  }, [sittaxUnlocked, location.pathname, navigate]);

  const handleVersionClick = useCallback(() => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (newCount >= 5) {
      setSittaxUnlocked(prev => !prev);
      setClickCount(0);
    } else {
      timeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 2000);
    }
  }, [clickCount]);

  const menuItems = useMemo(
    () => [
      {
        label: 'Sittax',
        selected: location.pathname === '/sittax',
        onClick: () => {
          navigate('/sittax', {
            replace: true,
            state: { from: location },
          });
        },
        visible: sittaxUnlocked,
      },
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
    [location, navigate, sittaxUnlocked]
  );

  return (
    <div className="flex px-6 py-4 justify-between h-fit items-center bg-background border-b z-10">
      <div className="flex gap-4 items-center">
        <img src={logoMonitor} alt="logo" className="rounded-md object-cover h-7" />
        <Separator orientation="vertical" className="h-7" />
        <div className="flex items-center h-7">
          {menuItems.filter(x => x.visible).map((item, index) => menuItemRender(item, index))}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <span
          className="text-sm text-muted-foreground font-semibold cursor-pointer select-none"
          onClick={handleVersionClick}
        >
          v{packageJson.version}
        </span>
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
