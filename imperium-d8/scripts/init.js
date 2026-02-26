import { ImperiumD8ActorSheet } from "./sheets/actor-sheet.js";
import { ImperiumD8TeamSheet } from "./sheets/team-sheet.js";
import { ImperiumD8ItemSheet } from "./sheets/item-sheet.js";
import { ImperiumD8Actor } from "./documents/actor.js";
import * as Rolls from "./rolls.js";

Hooks.once("init", async function () {
  console.log("[imperium-d8] Initializing Imperium D8 Skirmish system");

  // Register custom document classes (v13+ safe)
  CONFIG.Actor.documentClass = ImperiumD8Actor;

  // Make roll helpers available for macros
  game.imperiumD8 = {
    rolls: Rolls
  };

  // Unregister core sheets
  Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);

  // Register system sheets
  Actors.registerSheet("imperium-d8", ImperiumD8ActorSheet, { makeDefault: true, types: ["character"] });
  Actors.registerSheet("imperium-d8", ImperiumD8TeamSheet, { makeDefault: false, types: ["team"] });
  Items.registerSheet("imperium-d8", ImperiumD8ItemSheet, { makeDefault: true, types: ["weapon", "skill", "armor", "gear"] });

  // Preload templates
  const templatePaths = [
    "systems/imperium-d8/templates/actors/character-sheet.hbs",
    "systems/imperium-d8/templates/actors/team-sheet.hbs",
    "systems/imperium-d8/templates/items/item-sheet.hbs"
  ];
  await loadTemplates(templatePaths);
});

Hooks.on("preUpdateActor", (actor, changes) => {
  // Keep stats within 1-6 generally; during creation you'll keep 1-3 by policy.
  const attrs = changes?.system?.attributes;
  if (!attrs) return;
  for (const k of ["str","dex","end","awr","int","wil"]) {
    const v = attrs?.[k]?.value;
    if (v === undefined) continue;
    attrs[k].value = Math.clamp(Number(v), 1, 6);
  }
});
