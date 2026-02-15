export const toolSchemas = [
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get current unix time in ms.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "math_add",
      description: "Add two numbers safely.",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
        additionalProperties: false,
      },
    },
  },
];

export function runTool(name, args) {
  if (name === "get_time") return { nowMs: Date.now() };
  if (name === "math_add") return { result: Number(args.a) + Number(args.b) };
  return { error: "Tool not allowed" };
}
