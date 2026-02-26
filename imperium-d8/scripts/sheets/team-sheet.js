import * as Rolls from "../rolls.js";

export class ImperiumD8TeamSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["imperium", "sheet", "team"],
      template: "systems/imperium-d8/templates/actors/team-sheet.hbs",
      width: 860,
      height: 680,
      tabs: [] // team sheet is single-page
    });
  }

  /** @override */
  async getData(options) {
    const context = await super.getData(options);

    const roster = Array.isArray(this.actor.system.roster) ? this.actor.system.roster : [];
    const enriched = [];
    for (let i = 0; i < roster.length; i++) {
      const entry = roster[i] || {};
      const actorUuid = entry.actorUuid || "";
      const weaponUuid = entry.weaponUuid || "";
      const a = actorUuid ? await fromUuid(actorUuid) : null;
      if (!a) continue;

      const weapons = a.items.filter(it => it.type === "weapon").map(it => {
        const uuid = it.uuid;
        return {
          uuid,
          name: it.name,
          category: (it.system?.category || "").toLowerCase(),
          selected: uuid === weaponUuid
        };
      });

      // Default weapon selection to first weapon if missing
      const selectedWeaponUuid = weaponUuid || (weapons[0]?.uuid ?? "");
      if (!weaponUuid && selectedWeaponUuid) {
        // don't immediately persist; we'll persist on render to avoid loops
      }

      const selectedWeapon = selectedWeaponUuid ? a.items.get(selectedWeaponUuid.split(".").pop()) : null;
      const cat = (selectedWeapon?.system?.category || "").toLowerCase();
      // Enable buttons based on the selected weapon category.
      // Some worlds may have older weapons missing category; treat those as ranged by default.
      const canMelee = cat === "melee";
      const canRanged = cat !== "melee";

      enriched.push({
        index: i,
        actorUuid,
        weaponUuid: selectedWeaponUuid,
        name: a.name,
        wounds: Number(a.system?.trackers?.wounds?.value ?? 0),
        stress: Number(a.system?.trackers?.stress?.value ?? 0),
        weapons: weapons.map(w => ({...w, selected: w.uuid === selectedWeaponUuid})),
        canMelee,
        canRanged
      });
    }

    context.roster = enriched;
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Dropzone for actors
    html.find("[data-dropzone='roster']").on("dragover", ev => ev.preventDefault());
    html.find("[data-dropzone='roster']").on("drop", this._onDropRoster.bind(this));

    // Row actions
    html.find(".roster-row").on("click", (ev) => {
      const btn = ev.target.closest("[data-action]");
      if (!btn) return;
      ev.preventDefault();
      const action = btn.dataset.action;
      const row = ev.currentTarget;
      const index = Number(row.dataset.index);
      this._handleRowAction(action, row, index);
    });

    // Weapon select change
    html.find(".weapon-select").on("change", async (ev) => {
      const row = ev.currentTarget.closest(".roster-row");
      const index = Number(row.dataset.index);
      const weaponUuid = ev.currentTarget.value;
      await this._updateRosterEntry(index, { weaponUuid });
      this.render();
    });
  }

  async _onDropRoster(event) {
    // In v13, jQuery may wrap the native DragEvent. TextEditor.getDragEventData expects a real DragEvent.
    const dragEvent = event?.originalEvent ?? event;
    dragEvent?.preventDefault?.();

    // Foundry provides drag data in slightly different shapes depending on source (sidebar, links, etc.)
    const data = TextEditor.getDragEventData(dragEvent);
    if (!data) return;

    if (data.type !== "Actor") {
      return ui.notifications.warn("Drop an Actor onto the roster.");
    }

    // Support both uuid-based and id-based drag payloads
    const uuid = data.uuid ?? (data.id ? `Actor.${data.id}` : null);
    if (!uuid) {
      console.warn("ImperiumD8 | Team drop payload missing uuid/id", data);
      return ui.notifications.warn("Could not read the dropped Actor.");
    }

    const actor = await fromUuid(uuid);
    if (!actor) return ui.notifications.warn("Could not resolve dropped Actor.");

    // Only allow character actors
    if (actor.type !== "character") {
      return ui.notifications.warn("Only Character actors can be added to a Team.");
    }

    const roster = Array.isArray(this.actor.system.roster) ? foundry.utils.deepClone(this.actor.system.roster) : [];
    const exists = roster.some(r => r?.actorUuid === actor.uuid);
    if (exists) return ui.notifications.info(`${actor.name} is already on this roster.`);

    roster.push({ actorUuid: actor.uuid, weaponUuid: "" });
    await this.actor.update({ "system.roster": roster });
    this.render();
  }

  async _handleRowAction(action, row, index) {
    const entry = (this.actor.system.roster || [])[index];
    const actorUuid = entry?.actorUuid;
    const actor = actorUuid ? await fromUuid(actorUuid) : null;
    if (!actor) return;

    const weaponUuid = entry?.weaponUuid || "";
    const weapon = weaponUuid ? await fromUuid(weaponUuid) : null;

    switch (action) {
      case "open-actor":
        actor.sheet.render(true);
        break;

      case "remove-member":
        {
          const roster = foundry.utils.deepClone(this.actor.system.roster || []);
          roster.splice(index, 1);
          await this.actor.update({ "system.roster": roster });
          this.render();
        }
        break;

      case "wounds-inc":
        await this._bumpTracker(actor, "wounds", +1);
        this.render();
        break;
      case "wounds-dec":
        await this._bumpTracker(actor, "wounds", -1);
        this.render();
        break;
      case "stress-inc":
        await this._bumpTracker(actor, "stress", +1);
        this.render();
        break;
      case "stress-dec":
        await this._bumpTracker(actor, "stress", -1);
        this.render();
        break;

      case "roll-ranged":
        if (!weapon) return ui.notifications.warn("Select a weapon first.");
        await this._rollRanged(actor, weapon);
        break;

      case "roll-melee":
        if (!weapon) return ui.notifications.warn("Select a weapon first.");
        await this._rollMelee(actor, weapon);
        break;
    }
  }

  async _bumpTracker(actor, key, delta) {
    const path = `system.trackers.${key}.value`;
    const cur = Number(foundry.utils.getProperty(actor, path) ?? 0);
    const max = Number(foundry.utils.getProperty(actor, `system.trackers.${key}.max`) ?? 99);
    const next = Math.clamp(cur + delta, 0, max);
    await actor.update({ [path]: next });
  }

  async _rollRanged(actor, weapon) {
    const targetToken = game.user.targets?.first() ?? null;
    const targetActor = targetToken?.actor ?? null;
    const targetDEF = Number(targetActor?.system?.derived?.def?.value ?? 2);
    const targetArmor = Number(targetActor?.system?.armor?.dr ?? 0);

    const rangeIn = await this._promptNumber("Range (inches)", 12);
    if (rangeIn === null) return;
    const obstacles = await this._promptNumber("Obstacles (+TN)", 0);
    if (obstacles === null) return;

    await Rolls.rangedAttack({
      actor,
      weapon,
      rangeIn,
      targetDEF,
      targetArmor,
      obstacles
    });
  }

  async _rollMelee(actor, weapon) {
    const targetToken = game.user.targets?.first() ?? null;
    const targetActor = targetToken?.actor ?? null;
    const targetDEF = Number(targetActor?.system?.derived?.def?.value ?? 2);
    const targetArmor = Number(targetActor?.system?.armor?.dr ?? 0);

    await Rolls.meleeAttack({
      actor,
      weapon,
      targetDEF,
      targetArmor
    });
  }

  async _promptNumber(label, def) {
    return new Promise((resolve) => {
      new Dialog({
        title: label,
        content: `<p>${label}</p><input type="number" style="width:100%" value="${def}">`,
        buttons: {
          ok: {
            label: "OK",
            callback: (html) => {
              // In Foundry v13 the callback argument may be a jQuery object or a raw HTMLElement.
              const $html = (html?.find && typeof html.find === "function") ? html : $(html);
              const v = Number($html.find("input").val());
              resolve(Number.isFinite(v) ? v : def);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok"
      }).render(true);
    });
  }

  async _updateRosterEntry(index, patch) {
    const roster = foundry.utils.deepClone(this.actor.system.roster || []);
    roster[index] = foundry.utils.mergeObject(roster[index] || {}, patch);
    await this.actor.update({ "system.roster": roster });
  }
}