'use strict';

const GREEK = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ');

function chooseName(threads, names = []) {
  const list = names.length ? names : GREEK;
  const held = new Set(threads.filter((thread) => !thread.archived && thread.lead_name).map((thread) => thread.lead_name.toLowerCase()));
  for (let n = 1; ; n++) for (const name of list) {
    const candidate = n === 1 ? name : `${name} ${n}`;
    if (!held.has(candidate.toLowerCase())) return candidate;
  }
}

module.exports = { chooseName, GREEK };
