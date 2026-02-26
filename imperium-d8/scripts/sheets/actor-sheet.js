import * as Rolls from "../rolls.js";

export class ImperiumD8ActorSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["imperium-d8", "sheet", "actor"],
      template: "systems/imperium-d8/templates/actors/character-sheet.hbs",
      width: 880,
      height: 740,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "front" }]
    });
  }

  async getData(options) {
    const data = await super.getData(options);
    const actor = this.actor;

    const items = actor.items.contents;
    const weapons = items.filter((i) => i.type === "weapon");
    const skills = items.filter((i) => i.type === "skill");
    const armors = items.filter((i) => i.type === "armor");
    const gear = items.filter((i) => i.type === "gear");

    data.system = actor.system;
    data.weapons = weapons;
    data.skillItems = skills;
    data.armors = armors;
    data.gear = gear;

    data.skillLabels = {};
    for (const k of Object.keys(actor.system.skills ?? {})) {
      const loc = game.i18n.localize(`IMPERIUMD8.Skills.`);
      data.skillLabels[k] = (loc && !loc.startsWith("IMPERIUMD8.")) ? loc : k;
    }

    // Journal link (stored as a UUID string)
    data.bioJournalName = "";
    const uuid = actor.system?.bio?.journalUuid;
    if (uuid && typeof uuid === "string") {
      try {
        const doc = await fromUuid(uuid);
        data.bioJournalName = doc?.name ?? "";
      } catch (err) {
        data.bioJournalName = "";
      }
    }

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Per-actor accent theming
    const PRESET = {
      gold: "#F7AC08",
      red: "#B01B1B",
      blue: "#2B6CB0",
      green: "#2F855A",
      purple: "#6B46C1",
      steel: "#4A5568"
    };

    html.find(".accent-preset").on("change", async (ev) => {
      const preset = ev.currentTarget.value;
      if (preset === "custom") return;
      const accent = PRESET[preset] ?? PRESET.gold;
      // Update both fields so the sheet immediately reflects the choice
      await this.actor.update({
        "system.settings.accentPreset": preset,
        "system.settings.accent": accent
      });
    });

    html.find(".accent-color").on("change", async (ev) => {
      const accent = ev.currentTarget.value;
      // A manual color pick implies custom
      await this.actor.update({
        "system.settings.accentPreset": "custom",
        "system.settings.accent": accent
      });
    });

    // Item controls
    html.find(".item-create").on("click", this._onItemCreate.bind(this));
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li.dataset.itemId);
      item?.sheet?.render(true);
    });
    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li.dataset.itemId);
      if (!item) return;
      await item.delete();
    });

    // Rolls
    html.find(".roll-ranged").on("click", this._onRollRanged.bind(this));
    html.find(".roll-melee").on("click", this._onRollMelee.bind(this));
    html.find(".roll-check").on("click", this._onRollCheck.bind(this));

    // Journal link helpers
    const drop = html.find(".journal-drop");
    drop.on("dragover", (ev) => ev.preventDefault());
    drop.on("drop", this._onDropJournal.bind(this));
    html.find(".open-journal").on("click", this._onOpenJournal.bind(this));
    html.find(".clear-journal").on("click", this._onClearJournal.bind(this));
  }

  async _onDropJournal(event) {
    event.preventDefault();
    const ev = event.originalEvent ?? event;
    let data;
    try {
      data = TextEditor.getDragEventData(ev);
    } catch (e) {
      return;
    }
    if (!data) return;

    // Accept JournalEntry or JournalEntryPage
    const uuid = data.uuid || (data.type && data.id ? `${data.type}.${data.id}` : "");
    const t = String(data.type || "");
    const ok = t === "JournalEntry" || t === "JournalEntryPage" || uuid.startsWith("JournalEntry");
    if (!ok || !uuid) return ui.notifications.warn("Drop a Journal Entry (or Journal Page) here.");

    await this.actor.update({ "system.bio.journalUuid": uuid });
  }

  async _onOpenJournal(event) {
    event.preventDefault();
    const uuid = this.actor.system?.bio?.journalUuid;
    if (!uuid) return ui.notifications.warn("No Journal linked.");
    const doc = await fromUuid(uuid);
    if (!doc) return ui.notifications.warn("Linked Journal not found.");
    doc.sheet?.render(true);
  }

  async _onClearJournal(event) {
    event.preventDefault();
    await this.actor.update({ "system.bio.journalUuid": "" });
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const name = `New ${type}`;
    await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
  }

  async _onRollRanged(event) {
    event.preventDefault();
    const legacyRanged = new Set(["smallPistol","pistol","shotgun","carbine","rifle"]);
    const weapons = this.actor.items.filter((i) => {
      if (i.type !== "weapon") return false;
      const c = i.system?.category ?? "ranged";
      return c === "ranged" || legacyRanged.has(c);
    });
    if (!weapons.length) return ui.notifications.warn("No weapon items found.");

    const tgt = game.user.targets?.first?.() ?? Array.from(game.user.targets ?? [])[0];
    const tgtActor = tgt?.actor;
    const defaultDEF = Number(tgtActor?.system?.derived?.def?.value ?? 2);
    const defaultArmor = Number(tgtActor?.system?.armor?.value ?? 0);

    const weaponOptions = weapons.map((w) => `<option value="${w.id}">${w.name} (${w.system.weaponDice || ""})</option>`).join("");

    const content = `
      <form class="imperium-d8-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.UseWeapon")}</label>
          <select name="weaponId">${weaponOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.RangeInches")}</label>
          <input type="number" name="rangeIn" value="12" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.TargetDEF")}</label>
          <input type="number" name="targetDEF" value="${defaultDEF}" />
        </div>
        <div class="form-group">
          <label>Target Armor</label>
          <input type="number" name="targetArmor" value="${defaultArmor}" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.Obstacles")}</label>
          <input type="number" name="obstacles" value="0" />
        </div>
      </form>`;

    new Dialog({
      title: game.i18n.localize("IMPERIUMD8.UI.RollRanged"),
      content,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const weaponId = form.weaponId.value;
            const weapon = this.actor.items.get(weaponId);
            const rangeIn = Number(form.rangeIn.value);
            const targetDEF = Number(form.targetDEF.value);
            const targetArmor = Number(form.targetArmor.value);
            const obstacles = Number(form.obstacles.value);
            await Rolls.rangedAttack({ actor: this.actor, weapon, rangeIn, targetDEF, targetArmor, obstacles });
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollMelee(event) {
    event.preventDefault();
    const weapons = this.actor.items.filter((i) => {
      if (i.type !== "weapon") return false;
      const c = i.system?.category ?? "ranged";
      return c === "melee" || String(c).startsWith("melee");
    });
    if (!weapons.length) return ui.notifications.warn("No weapon items found.");

    const tgt = game.user.targets?.first?.() ?? Array.from(game.user.targets ?? [])[0];
    const tgtActor = tgt?.actor;
    const defaultDEF = Number(tgtActor?.system?.derived?.def?.value ?? 2);
    const defaultArmor = Number(tgtActor?.system?.armor?.value ?? 0);

    const weaponOptions = weapons.map((w) => `<option value="${w.id}">${w.name} (${w.system.weaponDice || ""})</option>`).join("");

    const content = `
      <form class="imperium-d8-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.UseWeapon")}</label>
          <select name="weaponId">${weaponOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.TargetDEF")}</label>
          <input type="number" name="targetDEF" value="${defaultDEF}" />
        </div>
        <div class="form-group">
          <label>Target Armor</label>
          <input type="number" name="targetArmor" value="${defaultArmor}" />
        </div>
      </form>`;

    new Dialog({
      title: game.i18n.localize("IMPERIUMD8.UI.RollMelee"),
      content,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const weaponId = form.weaponId.value;
            const weapon = this.actor.items.get(weaponId);
            const targetDEF = Number(form.targetDEF.value);
            const targetArmor = Number(form.targetArmor.value);
            await Rolls.meleeAttack({ actor: this.actor, weapon, targetDEF, targetArmor });
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }).render(true);
  }

  async _onRollCheck(event) {
    event.preventDefault();
    const stats = ["str","dex","end","awr","int","wil"];
    const statOptions = stats.map((k) => `<option value="${k}">${k.toUpperCase()}</option>`).join("");

    const skillKeys = Object.keys(this.actor.system.skills ?? {});
    const skillOptions = ["<option value=\"\">(none)</option>", ...skillKeys.map((k) => `<option value="${k}">${game.i18n.localize(`IMPERIUMD8.Skills.${k}`) || k}</option>`)].join("");

    const content = `
      <form class="imperium-d8-dialog">
        <div class="form-group">
          <label>Stat</label>
          <select name="statKey">${statOptions}</select>
        </div>
        <div class="form-group">
          <label>Skill</label>
          <select name="skillKey">${skillOptions}</select>
        </div>
        <div class="form-group">
          <label>Difficulty</label>
          <input type="number" name="difficulty" value="12" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("IMPERIUMD8.UI.Obstacles")}</label>
          <input type="number" name="obstacles" value="0" />
        </div>
      </form>`;

    new Dialog({
      title: game.i18n.localize("IMPERIUMD8.UI.RollCheck"),
      content,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (html) => {
            const form = html[0].querySelector("form");
            const statKey = form.statKey.value;
            const skillKey = form.skillKey.value;
            const difficulty = Number(form.difficulty.value);
            const obstacles = Number(form.obstacles.value);
            await Rolls.statCheck({ actor: this.actor, statKey, skillKey, difficulty, obstacles });
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "roll"
    }).render(true);
  }
}
