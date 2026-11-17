'use strict';

const GREEK = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ');

// Picks a random free name. Plain names come first; only once every one is held
// does it move on to "<name> 2", then "<name> 3", and so on.
function chooseName(threads, names = [], random = Math.random) {
  const list = names.length ? names : GREEK;
  const held = new Set(threads.filter((thread) => !thread.archived && thread.lead_name).map((thread) => thread.lead_name.toLowerCase()));
  for (let n = 1; ; n++) {
    const free = list.map((name) => (n === 1 ? name : `${name} ${n}`)).filter((candidate) => !held.has(candidate.toLowerCase()));
    if (free.length) return free[Math.floor(random() * free.length)];
  }
}

module.exports = { chooseName, GREEK };
