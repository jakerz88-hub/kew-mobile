// T1 ERROR — fontFamily string that isn't DM Sans or Lora.
// These are the only two typefaces in the Kew design system.
// Raw DM Sans / Lora strings are allowed (they are the approved values);
// anything else (Georgia, Helvetica, system-ui, etc.) is a violation.
// Allowlisted: src/types/theme.ts (where font names are assigned to tokens).
const APPROVED = /^(DMSans|Lora)/;
const ALLOWLIST = ["src/types/theme.ts"];

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "fontFamily must be DM Sans or Lora — no other typefaces in the Kew design system" },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWLIST.some((f) => filename.includes(f))) return {};
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : null;
        if (name !== "fontFamily") return;
        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          if (!APPROVED.test(node.value.value)) {
            context.report({
              node: node.value,
              message: `fontFamily '${node.value.value}' is not in the Kew type system. Use DM Sans (FontFamily.*) or Lora (FontFamily.serif).`,
            });
          }
        }
      },
    };
  },
};
