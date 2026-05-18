// T1 ERROR — Em dash (U+2014) in user-facing JSX content.
// Code comments are not AST nodes and are never matched.
module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Disallow em dash (—) in user-facing JSX text and strings" },
  },
  create(context) {
    function report(node) {
      context.report({ node, message: "Em dash (—) in user-facing text. Use a regular hyphen or reword." });
    }
    return {
      JSXText(node) {
        if (node.value.includes("—")) report(node);
      },
      // Covers all string literals: JSX expression containers (including ternaries),
      // plain object properties, function returns, variable assignments, etc.
      // "JSXExpressionContainer > Literal" was too narrow — ">" is direct-child only.
      Literal(node) {
        if (typeof node.value === "string" && node.value.includes("—")) report(node);
      },
    };
  },
};
