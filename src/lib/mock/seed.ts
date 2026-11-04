// Demo data for local development, dated relative to "now" so the dashboard
// always has something urgent, upcoming and new. Never used once Supabase is on.

import type { Dogadjaj } from '../dogadjaji';
import type { Boravak, ZahtevKalendara } from '../kalendar';
import { type IzmenaKartona, type UnosKartona, sazetak } from '../karton';
import type { RasporedCasova } from '../raspored-casova';
import type { Stavka, Unos } from '../tipovi';
import { danasnjiDan, kaoDatum, plusDana } from '../domen';

// The app never shows the child's name: everywhere it says "dete".
export const DETE = { ime: 'Dete' };

import { OBLASTI, RODITELJI } from '../osnova';

export { OBLASTI, RODITELJI };

export interface DemoStanje {
  stavke: Stavka[];
  unosi: Unos[];
  boravci: Boravak[];
  dogadjaji: Dogadjaj[];
  zahtevi: ZahtevKalendara[];
  karton: UnosKartona[];
  izmeneKartona: IzmenaKartona[];
  rasporedCasova: RasporedCasova | null;
  posete: Record<string, string | null>;
}

/** Demo timetable for a third grade, typed in by hand. */
function napraviRasporedCasova(t: string): RasporedCasova {
  return {
    casovi: ['1.', '2.', '3.', '4.', '5.'],
    tabela: [
      ['Srpski', 'Matematika', 'Srpski', 'Matematika', 'Srpski'],
      ['Matematika', 'Srpski', 'Matematika', 'Srpski', 'Matematika'],
      ['Priroda i društvo', 'Engleski', 'Fizičko', 'Priroda i društvo', 'Likovno'],
      ['Fizičko', 'Muzičko', 'Engleski', 'Fizičko', 'Likovno'],
      ['Čas odeljenjskog', '', 'Građansko', '', ''],
    ],
    slika: null,
    napomena: 'Smene se menjaju svake nedelje; ova nedelja je pre podne.',
    izmenio: 'mama',
    izmenjeno: t,
  };
}

/** Demo karton. Made-up values; real ones only ever live in the database. */
function napraviKarton(pre: (sati: number) => string): { karton: UnosKartona[]; izmeneKartona: IzmenaKartona[] } {
  const k: [UnosKartona['grupa'], string, string, string, number][] = [
    ['osnovno', 'Datum rođenja', '15. 4. 2018.', 'mama', 24 * 60],
    ['zdravlje', 'Pedijatar', 'dr Marković, Dom zdravlja, ambulanta 3\nPon–pet 7–14h', 'mama', 24 * 60],
    ['zdravlje', 'Alergije', 'Polen breze (proleće). Antihistaminik po potrebi, piše na receptu.', 'tata', 24 * 40],
    ['zdravlje', 'Krvna grupa', 'A+', 'mama', 24 * 60],
    ['zdravlje', 'Stomatolog', 'dr Ilić, kontrola na 6 meseci', 'tata', 24 * 41],
    ['skola', 'Škola', 'OŠ „Sveti Sava“', 'mama', 24 * 60],
    ['skola', 'Razred i odeljenje', '3/2', 'mama', 24 * 60],

    ['mere', 'Obuća', '34', 'tata', 24 * 5],
    ['mere', 'Odeća', '134–140', 'mama', 24 * 20],
  ];
  // Activities and contacts are lists of records, each with its own details.
  const z: [UnosKartona['grupa'], string, Record<string, string>, string, number][] = [
    ['aktivnosti', 'Fudbal', { termini: 'Utorak i četvrtak 17–18h', mesto: 'Teren kod škole', kontakt: 'Trener Nikola' }, 'tata', 24 * 50],
    ['aktivnosti', 'Engleski', { termini: 'Subota 10–11h', mesto: 'Škola jezika u centru', napomena: 'Knjiga je kod mame' }, 'mama', 24 * 45],
    ['kontakti', 'Baka i deka (mamini)', { napomena: 'Žive blizu škole, mogu da preuzmu u hitnom slučaju' }, 'mama', 24 * 60],
    ['kontakti', 'Komšinica Vesna', { napomena: 'Može da pričuva posle škole, javiti dan ranije' }, 'tata', 24 * 30],
    ['nastavnici', 'Ana Petrović', { predmet: 'Učiteljica', kontakt: 'Viber grupa odeljenja', napomena: 'Otvorena vrata utorkom posle 12h' }, 'mama', 24 * 60],
    ['nastavnici', 'Marko Jovanović', { predmet: 'Engleski' }, 'tata', 24 * 20],
    ['drugari', 'Luka iz odeljenja', { roditelj: 'Mama Jelena', napomena: 'Žive u istoj ulici kao škola' }, 'mama', 24 * 25],
  ];
  const karton: UnosKartona[] = [
    ...k.map(([grupa, naziv, vrednost, izmenio, sati], i) => ({
      id: `demo-k${i + 1}`,
      grupa,
      naziv,
      vrednost,
      izmenio,
      izmenjeno: pre(sati),
    })),
    ...z.map(([grupa, naziv, detalji, izmenio, sati], i) => ({
      id: `demo-kz${i + 1}`,
      grupa,
      naziv,
      vrednost: '',
      detalji,
      izmenio,
      izmenjeno: pre(sati),
    })),
  ];
  const izmeneKartona: IzmenaKartona[] = karton.map((u, i) => ({
    id: `demo-ki${i + 1}`,
    unosId: u.id,
    grupa: u.grupa,
    naziv: u.naziv,
    staro: null,
    novo: sazetak(u),
    autor: u.izmenio,
    kada: u.izmenjeno,
  }));
  // Shoe size went up recently: that change shows as an edit, not an addition.
  const obuca = izmeneKartona.find((z) => z.naziv === 'Obuća')!;
  obuca.kada = pre(24 * 90);
  obuca.novo = '33';
  izmeneKartona.push({ ...obuca, id: 'demo-ki-obuca', staro: '33', novo: '34', kada: pre(24 * 5) });
  return { karton, izmeneKartona };
}

/**
 * A plausible regular schedule from three weeks back to six weeks ahead:
 * weekdays with mama, Wednesday afternoon to Thursday morning with tata,
 * and every other weekend with tata (Friday 18:00 to Monday 08:00).
 */
function napraviRaspored(sada: Date, t: string): Boravak[] {
  const ponedeljak = plusDana(kaoDatum(danasnjiDan(sada)), -((sada.getDay() + 6) % 7));
  const r: Boravak[] = [];
  let n = 0;
  const dodaj = (kod: string, od: string, doT: string) =>
    r.push({ id: `demo-b${++n}`, vrsta: 'redovno', kod, od, do: doT, napomena: '', kreirano: t });
  for (let w = -3; w <= 6; w++) {
    const pon = plusDana(ponedeljak, w * 7);
    const sre = plusDana(pon, 2);
    const cet = plusDana(pon, 3);
    const pet = plusDana(pon, 4);
    const sledPon = plusDana(pon, 7);
    dodaj('mama', `${pon}T08:00`, `${sre}T15:00`);
    dodaj('tata', `${sre}T15:00`, `${cet}T08:00`);
    dodaj('mama', `${cet}T08:00`, `${pet}T18:00`);
    dodaj(w % 2 === 0 ? 'tata' : 'mama', `${pet}T18:00`, `${sledPon}T08:00`);
  }
  return r;
}

export function napraviSeed(sada: Date): DemoStanje {
  const dan = (n: number) => plusDana(kaoDatum(danasnjiDan(sada)), n);
  const pre = (sati: number) => new Date(sada.getTime() - sati * 3_600_000).toISOString();

  let n = 0;
  const stavke: Stavka[] = [];
  const unosi: Unos[] = [];

  function s(p: Partial<Stavka> & Pick<Stavka, 'naslov' | 'oblast' | 'otvorio'>, kreiranoPre: number): Stavka {
    const t = pre(kreiranoPre);
    const st: Stavka = {
      id: `demo-${++n}`,
      opis: '',
      stanje: 'neodgovoreno',
      vazno: false,
      hitno: false,
      datum: null,
      odluka: null,
      zatvaranjePredlozio: null,
      kreirano: t,
      izmenjeno: t,
      zatvoreno: null,
      ...p,
    };
    stavke.push(st);
    return st;
  }

  function u(st: Stavka, autor: string, tekst: string, satiPre: number, vrsta: Unos['vrsta'] = 'odgovor') {
    const t = pre(satiPre);
    unosi.push({ id: `demo-u${unosi.length + 1}`, stavkaId: st.id, autor, vrsta, tekst, kreirano: t });
    if (t > st.izmenjeno) st.izmenjeno = t;
  }

  s(
    {
      naslov: 'Saglasnost za izlet na Avalu',
      opis: 'Učiteljica traži potpisanu saglasnost i 1.200 dinara do četvrtka.',
      oblast: 'skola',
      otvorio: 'mama',
      datum: dan(2),
    },
    20,
  );

  const sastanak = s(
    {
      naslov: 'Roditeljski sastanak',
      opis: 'Sastanak je u 18h u učionici. Ko ide?',
      oblast: 'skola',
      otvorio: 'tata',
      stanje: 'otvoreno',
      datum: dan(6),
      odluka: 'Ide mama i posle upisuje beleške ovde.',
      zatvaranjePredlozio: 'mama',
    },
    50,
  );
  u(sastanak, 'mama', 'Ja mogu tog dana.', 30);
  u(sastanak, 'mama', 'Ide mama i posle upisuje beleške ovde.', 29, 'predlog_zatvaranja');

  const alergolog = s(
    {
      naslov: 'Kontrola kod alergologa',
      opis: 'Kontrolni pregled posle prolećne terapije. Termin je u 17h.',
      oblast: 'zdravlje',
      otvorio: 'tata',
      stanje: 'otvoreno',
      vazno: true,
      datum: dan(9),
    },
    120,
  );
  u(alergolog, 'mama', 'Može, ali ja radim do 17h. Možeš li ti da vodiš?', 100);
  u(alergolog, 'tata', 'Proveravam smenu pa javljam.', 70);

  s(
    {
      naslov: 'Sirup za kašalj: nastaviti ili ne?',
      opis: 'Kašalj je slabiji. Pedijatar je rekao 5 dana, danas je peti.',
      oblast: 'zdravlje',
      otvorio: 'tata',
      hitno: true,
    },
    3,
  );

  const plivanje = s(
    {
      naslov: 'Upis na plivanje za proleće',
      opis: 'Upis počinje sledećeg meseca. Termini utorkom i četvrtkom.',
      oblast: 'vanskolske',
      otvorio: 'mama',
      stanje: 'otvoreno',
      vazno: true,
      datum: dan(20),
    },
    200,
  );
  u(plivanje, 'tata', 'Za. Utorak mi više odgovara za vožnju.', 150);

  s(
    {
      naslov: 'Zimska jakna i čizme',
      opis: 'Prošlogodišnja jakna je mala. Kupujemo zajedno ili neko od nas?',
      oblast: 'potrebe',
      otvorio: 'mama',
    },
    26,
  );

  const lektira = s(
    {
      naslov: 'Lektira za novembar',
      opis: 'Ko nabavlja knjigu? U biblioteci je nema.',
      oblast: 'skola',
      otvorio: 'tata',
      stanje: 'otvoreno',
    },
    90,
  );
  u(lektira, 'mama', 'Pitaću u knjižari pored posla.', 80);

  const patike = s(
    {
      naslov: 'Patike za fizičko',
      oblast: 'potrebe',
      otvorio: 'mama',
      stanje: 'zatvoreno',
      odluka: 'Kupio tata, broj 34.',
      zatvoreno: pre(120),
    },
    170,
  );
  u(patike, 'tata', 'Kupujem ja ovog vikenda.', 160);
  u(patike, 'tata', 'Kupio tata, broj 34.', 125, 'predlog_zatvaranja');
  u(patike, 'mama', 'Kupio tata, broj 34.', 120, 'zatvoreno');

  const zubar = s(
    {
      naslov: 'Zubar: redovna kontrola',
      oblast: 'zdravlje',
      otvorio: 'tata',
      stanje: 'zatvoreno',
      datum: dan(12),
      odluka: 'Zakazano u 16h, vodi tata.',
      zatvoreno: pre(24 * 40),
    },
    24 * 42,
  );
  u(zubar, 'mama', 'Zakazano u 16h, vodi tata.', 24 * 41, 'predlog_zatvaranja');
  u(zubar, 'tata', 'Zakazano u 16h, vodi tata.', 24 * 40, 'zatvoreno');

  const zimovanje = s(
    {
      naslov: 'Zimovanje sa školom',
      oblast: 'vanskolske',
      otvorio: 'mama',
      stanje: 'zatvoreno',
      odluka: 'Ide, delimo trošak na pola. Uplata do 15. decembra.',
      zatvoreno: pre(24 * 12),
    },
    24 * 15,
  );
  u(zimovanje, 'tata', 'Slažem se, delimo na pola.', 24 * 14);
  u(zimovanje, 'mama', 'Ide, delimo trošak na pola. Uplata do 15. decembra.', 24 * 13, 'predlog_zatvaranja');
  u(zimovanje, 'tata', 'Ide, delimo trošak na pola. Uplata do 15. decembra.', 24 * 12, 'zatvoreno');

  const boravci = napraviRaspored(sada, pre(24 * 30));

  // Two open requests: mama asks to swap this week's Wednesday for Tuesday,
  // tata proposes the winter break and is waiting for mama.
  const ponedeljak = plusDana(dan(0), -((sada.getDay() + 6) % 7));
  const sledUtorak = plusDana(ponedeljak, 8);
  const zahtevi: ZahtevKalendara[] = [
    {
      id: 'demo-z1',
      vrsta: 'dodaj',
      boravakId: null,
      boravci: [
        { vrsta: 'izuzetak', kod: 'tata', od: `${sledUtorak}T15:00`, do: `${plusDana(sledUtorak, 1)}T08:00`, napomena: '' },
        { vrsta: 'izuzetak', kod: 'mama', od: `${plusDana(sledUtorak, 1)}T15:00`, do: `${plusDana(sledUtorak, 2)}T08:00`, napomena: '' },
      ],
      poruka: 'Sledeće srede imam roditeljski u drugoj školi. Može utorak umesto srede?',
      predlozio: 'mama',
      stanje: 'ceka',
      razlog: null,
      kreirano: pre(5),
      reseno: null,
      resio: null,
    },
    {
      id: 'demo-z2',
      vrsta: 'dodaj',
      boravakId: null,
      boravci: [{ vrsta: 'izuzetak', kod: 'tata', od: `${dan(52)}T10:00`, do: `${dan(56)}T18:00`, napomena: 'Planina' }],
      poruka: 'Predlažem da deo zimskog raspusta bude kod mene.',
      predlozio: 'tata',
      stanje: 'ceka',
      razlog: null,
      kreirano: pre(28),
      reseno: null,
      resio: null,
    },
  ];
  // History: two weeks ago mama took the Saturday of tata's weekend for a
  // birthday party; tata accepted, so it is part of the calendar now.
  const subota = plusDana(ponedeljak, -14 + 5);
  const rodjendan = { vrsta: 'izuzetak' as const, kod: 'mama', od: `${subota}T12:00`, do: `${subota}T20:00`, napomena: 'Rođendan kod drugara' };
  boravci.push({ ...rodjendan, id: 'demo-i1', kreirano: pre(24 * 17) });
  zahtevi.push({
    id: 'demo-z0',
    vrsta: 'dodaj',
    boravakId: null,
    boravci: [rodjendan],
    poruka: 'Rođendan je u subotu, mogu ja da vodim pa vraćam u 20h?',
    predlozio: 'mama',
    stanje: 'prihvacen',
    razlog: null,
    kreirano: pre(24 * 18),
    reseno: pre(24 * 17),
    resio: 'tata',
  });

  // Activities: two weekly trainings, a friend's birthday party, and mama's
  // proposal for another party that waits for tata.
  const pocetakMeseca = plusDana(ponedeljak, -21);
  const subotaZaNedelju = plusDana(ponedeljak, 12);
  const nedeljaZaNedelju = plusDana(ponedeljak, 13);
  const dogadjaji: Dogadjaj[] = [
    {
      id: 'demo-d1',
      naziv: 'Fudbal',
      vrsta: 'trening',
      datum: plusDana(pocetakMeseca, 1),
      ceoDan: false,
      od: '17:00',
      do: '18:00',
      ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [1, 3], do: null },
      vodi: null,
      mesto: 'Teren kod škole',
      napomena: 'Kopačke i flašica vode',
      kreirano: pre(24 * 60),
    },
    {
      id: 'demo-d2',
      naziv: 'Engleski',
      vrsta: 'skola',
      datum: plusDana(pocetakMeseca, 5),
      ceoDan: false,
      od: '10:00',
      do: '11:00',
      ponavljanje: { tip: 'nedeljno', svakih: 1, dani: [5], do: null },
      vodi: null,
      mesto: 'Škola jezika u centru',
      napomena: '',
      kreirano: pre(24 * 45),
    },
    {
      id: 'demo-d3',
      naziv: 'Rođendan drugara iz odeljenja',
      vrsta: 'rodjendan',
      datum: subotaZaNedelju,
      ceoDan: false,
      od: '12:00',
      do: '15:00',
      ponavljanje: { tip: 'ne' },
      vodi: 'tata',
      mesto: 'Igraonica kod tržnog centra',
      napomena: 'Poklon kupuje tata',
      kreirano: pre(24 * 3),
    },
  ];
  zahtevi.push({
    id: 'demo-z3',
    predmet: 'dogadjaj',
    vrsta: 'dodaj',
    boravakId: null,
    boravci: [],
    dogadjajId: null,
    dogadjaj: {
      naziv: 'Rođendan kod komšija',
      vrsta: 'rodjendan',
      datum: nedeljaZaNedelju,
      ceoDan: false,
      od: '16:00',
      do: '18:00',
      ponavljanje: { tip: 'ne' },
      vodi: 'mama',
      mesto: 'Kod komšija, drugi sprat',
      napomena: '',
    },
    poruka: 'Pozvani smo u nedelju, ja ga vodim.',
    predlozio: 'mama',
    stanje: 'ceka',
    razlog: null,
    kreirano: pre(2),
    reseno: null,
    resio: null,
  });

  return {
    stavke,
    unosi,
    boravci,
    dogadjaji,
    zahtevi,
    ...napraviKarton(pre),
    rasporedCasova: napraviRasporedCasova(pre(24 * 50)),
    posete: { tata: pre(48), mama: pre(30) },
  };
}
