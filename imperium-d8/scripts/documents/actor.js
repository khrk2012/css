import { syncSkillsFromItems, prepareDerived } from "../prepare.js";

/**
 * ImperiumD8Actor
 * v13+ safe: compute derived data in prepareDerivedData.
 */
export class ImperiumD8Actor extends Actor {
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();



    if (this.type === "team") {
      const sys = this.system;
      sys.roster ??= [];
      return;
    }

    if (this.type !== "character") return;

    // Ensure base structures exist (in case older actors were created)
    const sys = this.system;
    sys.meta ??= { rank: "", callsign: "" };
    sys.front ??= { notes: "" };
    sys.bio ??= { rank: "", callsign: "", cohort: "", homeworld: "", background: "", notes: "" };
    sys.attributes ??= {};
    sys.derived ??= { def: { value: 2 }, resolve: { value: 2 } };
    sys.skills ??= {};
    sys.trackers ??= { wounds: { value: 0, max: 3 }, stress: { value: 0, max: 6 } };
    sys.armor ??= { dr: 0 };
    sys.settings ??= { skillReduces: "range-only", minTN: 4, accentPreset: "gold", accent: "#F7AC08" };

    // Sanitize legacy fields that may have been saved as arrays/objects
    const toStr = (v) => {
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.join("");
      if (typeof v === "object") return String(v?.value ?? "");
      return String(v);
    };
    sys.meta.rank = toStr(sys.meta.rank);
    sys.meta.callsign = toStr(sys.meta.callsign);
    sys.front.notes = toStr(sys.front.notes);
    sys.bio.rank = toStr(sys.bio.rank);
    sys.bio.callsign = toStr(sys.bio.callsign);
    sys.bio.cohort = toStr(sys.bio.cohort);
    sys.bio.homeworld = toStr(sys.bio.homeworld);
    sys.bio.background = toStr(sys.bio.background);
    sys.bio.notes = toStr(sys.bio.notes);

    // Settings sanitize + defaults
    sys.settings.skillReduces = ["range-only", "full-tn"].includes(sys.settings.skillReduces) ? sys.settings.skillReduces : "range-only";
    sys.settings.minTN = Number.isFinite(Number(sys.settings.minTN)) ? Number(sys.settings.minTN) : 4;
    sys.settings.accentPreset = toStr(sys.settings.accentPreset || "gold");
    sys.settings.accent = toStr(sys.settings.accent || "");

    // If accent is missing/invalid, derive from preset
    const PRESET = {
      gold: "#F7AC08",
      red: "#B01B1B",
      blue: "#2B6CB0",
      green: "#2F855A",
      purple: "#6B46C1",
      steel: "#4A5568"
    };

    const isHex = (s) => typeof s === "string" && /^#([0-9a-fA-F]{6})$/.test(s.trim());
    if (!isHex(sys.settings.accent)) {
      const key = (sys.settings.accentPreset || "gold").toLowerCase();
      sys.settings.accent = PRESET[key] ?? PRESET.gold;
    }

    // Overlay skill Items (optional)
    try {
      syncSkillsFromItems(this);
    } catch (err) {
      console.warn("[imperium-d8] syncSkillsFromItems failed", err);
    }

    // Compute DEF/Resolve and clamp trackers
    try {
      prepareDerived(this);
    } catch (err) {
      console.warn("[imperium-d8] prepareDerived failed", err);
    }
  }
}
