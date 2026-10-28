import { useEffect, useState } from 'react';

export type Rota =
  | { tela: 'projetos' }
  | { tela: 'editor'; id: string }
  | { tela: 'corte' }
  | { tela: 'catalogo' }
  | { tela: 'config' }
  | { tela: 'admin' }
  | { tela: 'producao' }
  | { tela: 'termos' };

export function lerRota(hash = window.location.hash): Rota {
  const partes = hash.replace(/^#\/?/, '').split('/');
  switch (partes[0]) {
    case 'editor':
      return partes[1] ? { tela: 'editor', id: partes[1] } : { tela: 'projetos' };
    case 'corte':
      return { tela: 'corte' };
    case 'catalogo':
      return { tela: 'catalogo' };
    case 'config':
      return { tela: 'config' };
    case 'admin':
      return { tela: 'admin' };
    case 'producao':
      return { tela: 'producao' };
    case 'termos':
      return { tela: 'termos' };
    default:
      return { tela: 'projetos' };
  }
}

export const ir = (caminho: string) => {
  window.location.hash = caminho;
};

export function useRota() {
  const [rota, setRota] = useState(lerRota());
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}
