import * as THREE from 'three';

const KOSTKA = new THREE.BoxGeometry(1, 1, 1);

/* Skin z nagrania: czerwona maska, czarne boki, katany na plecach. */
export const SKIN_NAGRANIE = {
  tors: 0xb32234, konczyna: 0xb32234, noga: 0xa01f2e,
  maska: 0xc22a3c, ciemny: 0x17171b, stal: 0xc9ced6, katany: true,
};

/* Drugi ludzik — ten, którym chodzisz. Niebieski, bez broni, żeby ich nie mylić. */
export const SKIN_GRACZ = {
  tors: 0x2f6fb5, konczyna: 0x2f6fb5, noga: 0x27528a,
  maska: 0xe8c9a0, ciemny: 0x1b2430, stal: 0xc9ced6, katany: false,
};

const czesc = (w, h, d, kolor, x, y, z, rodzic) => {
  const m = new THREE.Mesh(KOSTKA, new THREE.MeshLambertMaterial({ color: kolor }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  rodzic.add(m);
  return m;
};

/* Blokowy ludzik, wzrost ~3,9 jednostki od stóp do czubka głowy.
   Zwraca grupę + kończyny do animacji. Promień 1,1 służy do zderzeń. */
export const PROMIEN = 1.1;

export function zbudujPostac(skin = SKIN_NAGRANIE) {
  const { tors: T, konczyna: K, noga: N, maska: M, ciemny: C, stal: S } = skin;
  const grupa = new THREE.Group();

  const tors = czesc(1.6, 1.8, 0.9, T, 0, 2.05, 0, grupa);
  czesc(1, 1, 1, C, -0.6, 0, 0, tors).scale.set(0.26, 1, 1.02);
  czesc(1, 1, 1, C, 0.6, 0, 0, tors).scale.set(0.26, 1, 1.02);
  czesc(1, 1, 1, 0x2a2a30, 0, -0.2, 0.5, tors).scale.set(0.32, 0.25, 0.24);

  const glowa = czesc(1.25, 1.25, 1.25, M, 0, 3.6, 0, grupa);
  czesc(1, 1, 1, C, -0.26, 0.05, 0.63, glowa).scale.set(0.34, 0.24, 0.09);
  czesc(1, 1, 1, C, 0.26, 0.05, 0.63, glowa).scale.set(0.34, 0.24, 0.09);
  czesc(1, 1, 1, 0xf2f2f4, -0.26, 0.07, 0.66, glowa).scale.set(0.21, 0.13, 0.05);
  czesc(1, 1, 1, 0xf2f2f4, 0.26, 0.07, 0.66, glowa).scale.set(0.21, 0.13, 0.05);

  if (skin.katany) {
    for (const znak of [-1, 1]) {
      const k = new THREE.Group();
      k.position.set(0, 2.4, -0.62);
      k.rotation.z = znak * 0.42;
      czesc(0.1, 2.6, 0.1, S, 0, 0.4, 0, k);
      czesc(0.16, 0.7, 0.16, C, 0, -1.05, 0, k);
      grupa.add(k);
    }
  }

  const konczyny = [];
  const konczyna = (x, y, kolor, dlugosc, szer) => {
    const piwot = new THREE.Group();
    piwot.position.set(x, y, 0);
    czesc(szer, dlugosc, szer, kolor, 0, -dlugosc / 2, 0, piwot);
    czesc(szer * 1.04, dlugosc * 0.3, szer * 1.04, C, 0, -dlugosc * 0.86, 0, piwot);
    grupa.add(piwot);
    konczyny.push(piwot);
  };
  konczyna(-1.06, 2.9, K, 1.7, 0.58);   // ręce
  konczyna(1.06, 2.9, K, 1.7, 0.58);
  konczyna(-0.4, 1.15, N, 1.15, 0.62);  // nogi
  konczyna(0.4, 1.15, N, 1.15, 0.62);

  return { grupa, konczyny };
}

/* Wahadło kończyn: ręce w przeciwfazie do nóg, w powietrzu rozkrok. */
export function animujChod(konczyny, faza, idzie, naZiemi) {
  const wychyl = naZiemi ? Math.sin(faza) * (idzie ? 0.85 : 0) : 0.5;
  konczyny[0].rotation.x = -wychyl;
  konczyny[1].rotation.x = wychyl;
  konczyny[2].rotation.x = wychyl;
  konczyny[3].rotation.x = -wychyl;
}
