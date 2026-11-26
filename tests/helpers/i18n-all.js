// Tests intentionally load every catalog; browser startup loads just one.
import {loadLocale} from "../../src/i18n.js";
await Promise.all(["fr","uk","ru"].map(loadLocale));
export * from "../../src/i18n.js";
