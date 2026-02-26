function getSkillRank(actor, key) {
  const fromSystem = Number(actor.system?.skills?.[key]?.rank ?? 0);
  if (fromSystem) return fromSystem;
  const skillItem = actor.items.find((i) => i.type === "skill" && i.system?.key === key);
  return Number(skillItem?.system?.rank ?? 0);
}

function clampMinTN(actor, tn) {
  const minTN = Number(actor.system?.settings?.minTN ?? 4);
  return Math.max(minTN, tn);
}

export function weaponDiceLabel(dice) {
  return dice || "";
}

export async function rangedAttack({ actor, weapon, rangeIn = 6, targetDEF = 2, targetArmor = 0, obstacles = 0 } = {}) {
  if (!actor) throw new Error("No actor provided.");
  if (!weapon) throw new Error("No weapon provided.");

  const attackStat = weapon.system.attackStat || "dex";
  const statValue = Number(actor.system.attributes?.[attackStat]?.value ?? 2);
  const statDice = `${statValue}d8`;

  const weaponDice = weapon.system.weaponDice || "";
  const skillKey = weapon.system.skillKey || "marksmanship";
  const skillRank = getSkillRank(actor, skillKey);

  // TN = (Range - Skill) + TargetDEF + Obstacles
  // Skill reduces range portion only (locked earlier)
  const tnRaw = (Number(rangeIn) - skillRank) + Number(targetDEF) + Number(obstacles);
  const tn = clampMinTN(actor, tnRaw);

  const formula = weaponDice ? `${statDice} + ${weaponDice}` : `${statDice}`;
  const roll = await (new Roll(formula)).evaluate({ async: true });

  const hit = roll.total >= tn;
  const margin = roll.total - tn;

  // Damage (optional): Damage = Margin - max(0, Armor - AP)
  const ap = Number(weapon.system?.damage?.ap ?? 0);
  const effectiveArmor = Math.max(0, Number(targetArmor) - ap);
  const damage = hit ? Math.max(0, margin - effectiveArmor) : 0;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<b>Ranged Attack</b> (${actor.name})<br/>
      Weapon: ${weapon.name} (${formula})<br/>
      TN: ${tn} (Range ${rangeIn} - Skill ${skillRank} + DEF ${targetDEF} + Obst ${obstacles})<br/>
      Result: <b>${hit ? "HIT" : "MISS"}</b>${hit ? ` (Margin ${margin})<br/>Damage: <b>${damage}</b> (Armor ${targetArmor} → ${effectiveArmor} vs AP ${ap})` : ""}`
  });

  return { roll, tn, hit, margin, damage, targetArmor, ap };
}

export async function meleeAttack({ actor, weapon, targetDEF = 2, targetArmor = 0 } = {}) {
  if (!actor) throw new Error("No actor provided.");
  if (!weapon) throw new Error("No weapon provided.");

  const attackStat = weapon.system.attackStat || "str";
  const statValue = Number(actor.system.attributes?.[attackStat]?.value ?? 2);
  const statDice = `${statValue}d8`;

  const weaponDice = weapon.system.weaponDice || "";
  const skillKey = weapon.system.skillKey || "closeCombat";
  const skillRank = getSkillRank(actor, skillKey);

  // TN = TargetDEF - Skill
  const tnRaw = Number(targetDEF) - skillRank;
  const tn = clampMinTN(actor, tnRaw);

  const formula = weaponDice ? `${statDice} + ${weaponDice}` : `${statDice}`;
  const roll = await (new Roll(formula)).evaluate({ async: true });

  const hit = roll.total >= tn;
  const margin = roll.total - tn;

  const ap = Number(weapon.system?.damage?.ap ?? 0);
  const effectiveArmor = Math.max(0, Number(targetArmor) - ap);
  const damage = hit ? Math.max(0, margin - effectiveArmor) : 0;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<b>Melee Attack</b> (${actor.name})<br/>
      Weapon: ${weapon.name} (${formula})<br/>
      TN: ${tn} (DEF ${targetDEF} - Skill ${skillRank})<br/>
      Result: <b>${hit ? "HIT" : "MISS"}</b>${hit ? ` (Margin ${margin})<br/>Damage: <b>${damage}</b> (Armor ${targetArmor} → ${effectiveArmor} vs AP ${ap})` : ""}`
  });

  return { roll, tn, hit, margin, damage, targetArmor, ap };
}

export async function statCheck({ actor, statKey = "dex", skillKey = "", difficulty = 12, obstacles = 0 } = {}) {
  if (!actor) throw new Error("No actor provided.");
  const statValue = Number(actor.system.attributes?.[statKey]?.value ?? 2);
  const statDice = `${statValue}d8`;

  const skillRank = skillKey ? getSkillRank(actor, skillKey) : 0;

  // TN = Difficulty + Obstacles - Skill
  const tnRaw = Number(difficulty) + Number(obstacles) - Number(skillRank);
  const tn = clampMinTN(actor, tnRaw);

  const roll = await (new Roll(statDice)).evaluate({ async: true });
  const pass = roll.total >= tn;
  const margin = roll.total - tn;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<b>Check</b> (${actor.name})<br/>
      Roll: ${statDice}<br/>
      TN: ${tn} (Diff ${difficulty} + Obst ${obstacles}${skillKey ? ` - Skill ${skillRank}` : ""})<br/>
      Result: <b>${pass ? "PASS" : "FAIL"}</b>${pass ? ` (Margin ${margin})` : ""}`
  });

  return { roll, tn, pass, margin };
}
