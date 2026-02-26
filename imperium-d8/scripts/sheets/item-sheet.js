export class ImperiumD8ItemSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["imperium-d8", "sheet", "item"],
      template: "systems/imperium-d8/templates/items/item-sheet.hbs",
      width: 520,
      height: 520
    });
  }

  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    data.itemType = this.item.type;

    data.weaponCategories = [
      { key: "melee", label: game.i18n.localize("IMPERIUMD8.WeaponCategory.melee") },
      { key: "ranged", label: game.i18n.localize("IMPERIUMD8.WeaponCategory.ranged") },
      { key: "heavy", label: game.i18n.localize("IMPERIUMD8.WeaponCategory.heavy") }
    ];

    data.attackStats = [
      { key: "dex", label: "DEX" },
      { key: "str", label: "STR" }
    ];

    data.skillKeys = [
      "marksmanship","quickdraw","targetAcquisition",
      "closeCombat","takedown","fortitude",
      "hacking","demolitions","fieldMedicine",
      "resolveTraining","interrogation","tactics",
      "stealth","athletics","survival","persuasion","mechanics"
    ].map((k) => ({ key: k, label: game.i18n.localize(`IMPERIUMD8.Skills.${k}`) || k }));

    data.skillStats = [
      { key: "str", label: "STR" },
      { key: "dex", label: "DEX" },
      { key: "end", label: "END" },
      { key: "awr", label: "AWR" },
      { key: "int", label: "INT" },
      { key: "wil", label: "WIL" }
    ];

    return data;
  }
}
