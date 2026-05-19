// T2 ERROR — Arithmetic on Spacing.* tokens (e.g. `Spacing.sm + 2`).
// Off-token values defeat the spacing scale; add an intermediate token to
// src/types/theme.ts (s6, s10, s12, s14 already exist) and use it directly.
//
// Lint catches:
//   Spacing.sm + 2        (BinaryExpression, Spacing.X on left)
//   2 + Spacing.sm        (BinaryExpression, Spacing.X on right)
//   Spacing.md - 2
//   Spacing.sm * 2
//
// Composite layout calcs that legitimately mix spacing with other dimensions
// (e.g. icon width + Spacing.md) can be suppressed with
// `// eslint-disable-next-line kew/no-spacing-arithmetic` plus a comment
// explaining why.

const ALLOWLIST = ["src/types/theme.ts"];

function isSpacingMember(node) {
  return (
    node &&
    node.type === "MemberExpression" &&
    node.object &&
    node.object.type === "Identifier" &&
    node.object.name === "Spacing"
  );
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow arithmetic on Spacing.* token references" },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWLIST.some((f) => filename.includes(f))) return {};
    return {
      BinaryExpression(node) {
        if (!["+", "-", "*", "/"].includes(node.operator)) return;
        if (isSpacingMember(node.left) || isSpacingMember(node.right)) {
          context.report({
            node,
            message:
              "Arithmetic on Spacing.* is off-token. Use a direct Spacing.X token from src/types/theme.ts (s6/s10/s12/s14 exist for the gaps between xs/sm/md), or suppress with a reason if it's a composite layout calc.",
          });
        }
      },
    };
  },
};
