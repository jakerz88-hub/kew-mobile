// T2 WARN — "white" / "#FFFFFF" as color property values.
// Use colors.cream or colors.buttonText instead.
const WHITE = new Set(["white", "#FFFFFF", "#ffffff", "#FFF", "#fff"]);
const COLOR_PROPS = new Set([
  "color", "backgroundColor", "borderColor", "tintColor",
  "placeholderTextColor", "selectionColor",
]);
const ALLOWLIST = ["src/types/theme.ts"];

module.exports = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow raw 'white'/'#FFFFFF' color values — use colors.cream or colors.buttonText" },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWLIST.some((f) => filename.includes(f))) return {};
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : null;
        if (!name || !COLOR_PROPS.has(name)) return;
        if (node.value.type === "Literal" && WHITE.has(String(node.value.value))) {
          context.report({ node: node.value, message: `Raw '${node.value.value}' — use colors.cream or colors.buttonText.` });
        }
      },
    };
  },
};
