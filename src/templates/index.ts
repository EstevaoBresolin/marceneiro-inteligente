import { armarioBanheiro } from './armarioBanheiro';
import { livre, nicho, prateleira, suporteMonitor } from './outros';
import type { Template } from './types';

export * from './types';

/** Para adicionar um móvel novo: crie um arquivo em src/templates/ e registre aqui. */
export const TEMPLATES: Template[] = [armarioBanheiro, nicho, prateleira, suporteMonitor, livre];

export const templatePorId = (id: string) => TEMPLATES.find((t) => t.id === id) ?? livre;

/** id da linha na lista de peças ("lateral#2" → "lateral") */
export const idBase = (id: string) => id.split('#')[0];
