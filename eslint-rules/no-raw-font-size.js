// T2 WARN — Numeric fontSize literals and arithmetic on FontSize tokens.
// Use FontSize.* tokens from src/types/theme.ts.
// Also catches fontSize: FontSize.xxs + 1 (BinaryExpression).
const ALLOWLIST = ["src/types/theme.ts"];

module.exports = {
  meta: {
    type: "suggestion",
    docs: { description: "fontSize values must use FontSize.* tokens, not raw numbers" },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWLIST.some((f) => filename.includes(f))) return {};
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : null;
        if (name !== "fontSize") return;
        if (node.value.type === "Literal" && typeof node.value.value === "number") {
          context.report({ node: node.value, message: `Raw fontSize ${node.value.value} — use FontSize.* token from src/types/theme.ts.` });
        }
        if (node.value.type === "BinaryExpression") {
          context.report({ node: node.value, message: "Arithmetic on fontSize — use FontSize.* token directly." });
        }
      },
    };
  },
};
