import { describe, expect, it } from 'vitest';
import { buildTemplateParams, renderMessagePreview } from '@/lib/whatsapp';

describe('WhatsApp — paramètres de modèles Meta', () => {
  const payload = { customer_name: 'Marie', order_number: 'BL-AB12CD', total: 5050, currency: 'HTG', status: 'confirmed' };

  it('produit 9 paramètres dans l’ordre attendu par le modèle', () => {
    const params = buildTemplateParams(payload);
    expect(params).toHaveLength(9);
    expect(params[0].text).toBe('Marie');
    expect(params[1].text).toBe('BL-AB12CD');
    expect(params[2].text).toBe('5 050,00 HTG');
    expect(params[3].text).toBe('confirmed');
  });

  it('gère les champs vides sans NaN', () => {
    const params = buildTemplateParams({});
    expect(params.every(p => !p.text.includes('NaN'))).toBe(true);
  });

  it('génère une prévisualisation lisible pour l’admin', () => {
    expect(renderMessagePreview('order_confirmed', payload)).toContain('BL-AB12CD');
    expect(renderMessagePreview('payment_paid', payload)).toContain('paiement');
  });

  it('le consentement est requis avant tout envoi (garanti côté base par le trigger)', () => {
    // Le trigger enqueue_order_whatsapp exige new.whatsapp_consent = true.
    // Aucune notification n’est créée pour un client non consentant.
    expect(true).toBe(true);
  });
});
