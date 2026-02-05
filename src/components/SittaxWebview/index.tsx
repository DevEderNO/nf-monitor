import { useEffect, useRef, useState } from 'react';

interface SittaxWebviewProps {
  visible: boolean;
}

export function SittaxWebview({ visible }: SittaxWebviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    // Só carrega o token quando ficar visível pela primeira vez
    if (visible && !hasLoadedOnce.current && !url) {
      hasLoadedOnce.current = true;

      async function getSittaxToken() {
        try {
          setLoading(true);
          const token = await window.ipcRenderer.invoke('get-sittax-token');
          if (token) {
            setUrl(`https://app.sittax.com.br/autologin?token=${encodeURIComponent(token)}`);
          } else {
            setError('Não foi possível fazer login no Sittax. Tente novamente.');
          }
        } catch (err) {
          setError('Erro ao conectar com o Sittax.');
        } finally {
          setLoading(false);
        }
      }

      getSittaxToken();
    }
  }, [visible, url]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadStart = () => setWebviewLoading(true);
    const handleLoadStop = () => setWebviewLoading(false);

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
    };
  }, [url]);

  // Se não tem URL ainda e não está visível, não renderiza nada
  if (!url && !visible) {
    return null;
  }

  // Estilos para esconder o webview mantendo-o no DOM
  const hiddenStyle: React.CSSProperties = !visible ? {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: '100%',
    height: '100%',
  } : {};

  if (loading && visible) {
    return (
      <div className="flex-1 min-h-0 w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">Carregando Sittax...</p>
      </div>
    );
  }

  if (error && visible) {
    return (
      <div className="flex-1 min-h-0 w-full h-full flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!url && visible) {
    return (
      <div className="flex-1 min-h-0 w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">Carregando Sittax...</p>
      </div>
    );
  }

  // Renderiza o webview (visível ou escondido para manter o estado)
  if (!url) return null;

  return (
    <div
      className="flex-1 min-h-0 w-full h-full flex flex-col relative"
      style={hiddenStyle}
    >
      {webviewLoading && visible && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      )}
      <webview
        ref={webviewRef}
        src={url}
        partition="persist:sittax"
        className="w-full h-full border-0"
        style={{ flex: 1 }}
      />
    </div>
  );
}
