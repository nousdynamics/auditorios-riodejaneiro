import { describe, expect, it } from 'vitest';
import { corporateWhatsappMessage, roomWhatsappMessage } from '../src/worker/views/ui';

describe('mensagens prontas do WhatsApp', () => {
  it('traz nome e capacidade da sala', () => {
    const msg = roomWhatsappMessage({ name: 'Auditório 1', capacityMin: 30, capacityMax: 50, floor: '' }, 'https://x.com.br/auditorios/auditorio-1');
    expect(msg).toBe('Olá! Quero o Auditório 1, para 30 a 50 pessoas.\nPode me passar a disponibilidade e os valores?\nhttps://x.com.br/auditorios/auditorio-1');
  });
  it('inclui o andar e ajusta artigo e capacidade máxima', () => {
    expect(roomWhatsappMessage({ name: 'Sala Rio', capacityMin: 0, capacityMax: 20, floor: '14º andar' })).toBe(
      'Olá! Quero a Sala Rio (14º andar), para até 20 pessoas.\nPode me passar a disponibilidade e os valores?',
    );
  });
  it('pacote corporativo', () => {
    expect(corporateWhatsappMessage()).toContain('pacote corporativo, com o andar completo');
  });
});
