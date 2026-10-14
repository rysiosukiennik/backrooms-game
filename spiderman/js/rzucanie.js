// STUB kontraktu rzucania przedmiotami (wlasciwy modul pisze agent STEROWANIE; przy scalaniu ten plik jest zastepowany).
// registerThrowable({ pos, mesh, radius, mass, kind, onHit }) -> wpis; throwTargets: [{ box | pos+radius, onHit(power, obiekt) }]
export const throwables = [];
export const throwTargets = [];
export function registerThrowable(o) { throwables.push(o); return o; }
export function unregisterThrowable(o) { const i = throwables.indexOf(o); if (i >= 0) throwables.splice(i, 1); }
