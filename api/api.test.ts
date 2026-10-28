import { beforeEach, describe, expect, it } from 'vitest';
import admin from './admin';
import eventos from './eventos';
import feedback from './feedback';
import { limparMemoria, type Req } from './_lib';

function chamar(h: (req: Req, res: never) => Promise<void>, req: Partial<Req>) {
  return new Promise<{ status: number; body: unknown }>((ok) => {
    let status = 200;
    const res = {
      status: (n: number) => ((status = n), res),
      json: (b: unknown) => ok({ status, body: b }),
      send: (b: unknown) => ok({ status, body: b }),
      setHeader: () => {},
    };
    void h({ method: 'POST', query: {}, headers: {}, ...req } as Req, res as never);
  });
}

const id = { instalacao: 'abc123-def', empresa: 'Marcenaria Teste', responsavel: 'João', telefone: '54999', cidade: 'Caxias', versao: '0.3.0' };

describe('api do período de teste', () => {
  beforeEach(() => {
    limparMemoria();
    process.env.ADMIN_TOKEN = 'segredo-123';
  });

  it('eventos viram resumo por marcenaria, sem contar repetidos', async () => {
    const ev = [
      { id: 'e1', tipo: 'app_aberto', em: Date.now() },
      { id: 'e2', tipo: 'projeto_criado', em: Date.now(), dados: { modelo: 'nicho' } },
    ];
    expect((await chamar(eventos, { body: { ...id, eventos: ev } })).status).toBe(200);
    // mesmo lote de novo (reenvio): não duplica
    await chamar(eventos, { body: { ...id, eventos: ev } });
    await chamar(eventos, { body: JSON.stringify({ ...id, eventos: [{ id: 'e3', tipo: 'exportou', em: Date.now(), dados: { tipo: 'corte' } }] }) });
    const r = await chamar(admin, { method: 'GET', query: { token: 'segredo-123' } });
    const m = (r.body as { marcenarias: { empresa: string; totais: Record<string, number> }[] }).marcenarias;
    expect(m).toHaveLength(1);
    expect(m[0].empresa).toBe('Marcenaria Teste');
    expect(m[0].totais).toEqual({ app_aberto: 1, projeto_criado: 1, exportou: 1 });
  });

  it('feedback com print e leitura protegida da imagem', async () => {
    await chamar(eventos, { body: { ...id, eventos: [{ id: 'x1', tipo: 'app_aberto', em: Date.now() }] } });
    const png = 'data:image/jpeg;base64,' + Buffer.from('imagem-falsa').toString('base64');
    expect((await chamar(feedback, { body: { ...id, id: 'fb000001', tipo: 'problema', texto: 'O plano não abriu', imagem: png, tela: '#/editor/1' } })).status).toBe(200);
    const r = await chamar(admin, { method: 'GET', query: { token: 'segredo-123' } });
    const b = r.body as { feedbacks: { texto: string; imagem: string }[]; marcenarias: { feedbacks: number }[] };
    expect(b.feedbacks[0].texto).toBe('O plano não abriu');
    expect(b.marcenarias[0].feedbacks).toBe(1);
    const img = await chamar(admin, { method: 'GET', query: { token: 'segredo-123', imagem: b.feedbacks[0].imagem } });
    expect(String(img.body)).toBe('imagem-falsa');
  });

  it('recusa sem token, com token errado e dados inválidos', async () => {
    expect((await chamar(admin, { method: 'GET', query: {} })).status).toBe(401);
    expect((await chamar(admin, { method: 'GET', query: { token: 'segredo-124' } })).status).toBe(401);
    expect((await chamar(eventos, { body: { instalacao: '../x', eventos: [] } })).status).toBe(400);
    expect((await chamar(feedback, { body: { ...id, texto: '   ' } })).status).toBe(400);
    expect((await chamar(admin, { method: 'GET', query: { token: 'segredo-123', imagem: '../../segredo' } })).status).toBe(400);
  });
});
