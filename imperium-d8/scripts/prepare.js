/**
 * Sync actor.system.skills.<key>.rank from embedded Skill items (type: "skill").
 * This keeps the sheet simple and lets you manage skills as Items if you want.
 * You can ignore Skill items and just edit actor.system.skills directly.
 */
export function syncSkillsFromItems(actor) {
  const sys = actor.system;
  if (!sys?.skills) return;

  // Start with current system skills (manual edits) and then overlay skill items
  const skillItems = actor.items.filter((i) => i.type === "skill");
  for (const it of skillItems) {
    const key = (it.system.key || "").trim();
    if (!key) continue;
    if (!sys.skills[key]) sys.skills[key] = { rank: 0 };
    sys.skills[key].rank = Number(it.system.rank ?? 0);
  }
}

export function prepareDerived(actor) {
  const sys = actor.system;
  const dex = Number(sys.attributes.dex.value ?? 2);
  const awr = Number(sys.attributes.awr.value ?? 2);
  const wil = Number(sys.attributes.wil.value ?? 2);

  sys.derived.def.value = Math.floor((dex + awr) / 2);
  sys.derived.resolve.value = wil;
  // Derived trackers
  // Wounds max = floor(sum(stats)/2)
  const str = Number(sys.attributes.str.value ?? 2);
  const end = Number(sys.attributes.end.value ?? 2);
  const intel = Number(sys.attributes.int.value ?? 2);

  const woundsMax = Math.max(1, Math.floor((str + dex + end + awr + intel + wil) / 2));
  sys.trackers ??= {};
  sys.trackers.wounds ??= { value: 0, max: woundsMax };
  sys.trackers.wounds.max = woundsMax;
  sys.trackers.wounds.value = Math.max(0, Number(sys.trackers.wounds.value ?? 0));

  // Stress stays manually configurable (default from template)
  sys.trackers.stress ??= { value: 0, max: 6 };
  sys.trackers.stress.value = Math.max(0, Number(sys.trackers.stress.value ?? 0));
  sys.trackers.stress.max = Math.max(1, Number(sys.trackers.stress.max ?? 6));

  // Momentum: individual per actor; max derived (not hard-coded)
  // Default max = Resolve (WIL) + 1, so baseline WIL 2 -> max 3.
  const momentumMax = Math.max(0, Number(sys.trackers.momentum?.max ?? (wil + 1)));
  sys.trackers.momentum ??= { value: 1, max: momentumMax };
  sys.trackers.momentum.max = momentumMax;
  sys.trackers.momentum.value = Math.max(0, Math.min(momentumMax, Number(sys.trackers.momentum.value ?? 0)));


  // Clamp armor DR
  if (sys.armor) sys.armor.dr = Math.max(0, Number(sys.armor.dr ?? 0));
}
