// T2 WARN — borderRadius: 999 hardcode. Use Radius.pill instead.
module.exports = {
  meta: {
    type: "suggestion",
    docs: { description: "Use Radius.pill instead of hardcoded borderRadius: 999" },
  },
  create(context) {
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : null;
        if (name !== "borderRadius") return;
        if (node.value.type === "Literal" && node.value.value === 999) {
          context.report({ node: node.value, message: "Use Radius.pill instead of borderRadius: 999." });
        }
      },
    };
  },
};
