// T2 WARN — Raw hex/rgba color literals outside the theme file.
// Allowlisted: src/types/theme.ts (where tokens are defined).
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_RE = /^rgba?\s*\(/;
const ALLOWLIST = ["src/types/theme.ts"];

module.exports = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow raw hex/rgba color literals — use theme tokens" },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWLIST.some((f) => filename.includes(f))) return {};
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (HEX_RE.test(node.value) || RGBA_RE.test(node.value)) {
          context.report({ node, message: `Raw color '${node.value}' — use a theme token from src/types/theme.ts.` });
        }
      },
    };
  },
};
