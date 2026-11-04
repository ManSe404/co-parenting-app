import { describe, expect, it } from 'vitest';
import { GreskaProfila, mapaLink, popunjen, prazanProfil, proveriProfil, telLink } from './profil';

const prazno = { ime: '', telefon: '', adresa: '', kontaktEmail: '', napomena: '' };

describe('profil roditelja', () => {
  it('čisti razmake, mejl u mala slova; prazan profil je ispravan', () => {
    expect(proveriProfil({ ...prazno, ime: '  Petar   Petrović ', kontaktEmail: ' Petar@Primer.RS ' })).toMatchObject({
      ime: 'Petar Petrović',
      kontaktEmail: 'petar@primer.rs',
    });
    expect(proveriProfil(prazno)).toEqual(prazno);
  });

  it('telefon samo sa ciframa i znakovima, mejl mora biti ispravan', () => {
    expect(proveriProfil({ ...prazno, telefon: '+381 (64) 123-45/67' }).telefon).toBe('+381 (64) 123-45/67');
    expect(() => proveriProfil({ ...prazno, telefon: 'zovi posle 5' })).toThrow(GreskaProfila);
    expect(() => proveriProfil({ ...prazno, kontaktEmail: 'nije-mejl' })).toThrow(/Mejl/);
    expect(() => proveriProfil({ ...prazno, napomena: 'x'.repeat(301) })).toThrow(/Napomena/);
  });

  it('veze za poziv i mapu', () => {
    expect(telLink('064 123 4567')).toBe('tel:0641234567');
    expect(telLink('+381 64 123-4567')).toBe('tel:+381641234567');
    expect(mapaLink('Njegoševa 12, Beograd')).toBe('https://www.google.com/maps/search/?api=1&query=Njego%C5%A1eva%2012%2C%20Beograd');
  });

  it('popunjen je čim postoji bilo koji podatak', () => {
    expect(popunjen(prazanProfil())).toBe(false);
    expect(popunjen({ ...prazanProfil(), telefon: '064' })).toBe(true);
  });
});
