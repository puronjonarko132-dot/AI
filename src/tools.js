function detectFallacies(claim = "") {
  const text = String(claim).toLowerCase();
  const findings = [];

  if (/everyone|nobody|always|never/.test(text)) {
    findings.push("possible overgeneralization");
  }
  if (/because i said so|just trust me/.test(text)) {
    findings.push("possible appeal to authority without evidence");
  }
  if (/if not .* then .* doomed|disaster|ruined/.test(text)) {
    findings.push("possible false dilemma / slippery slope");
  }

  return findings;
}

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
  {
    type: "function",
    function: {
      name: "analyze_claim",
      description: "Quickly analyze a claim for debate quality and possible logic issues.",
      parameters: {
        type: "object",
        properties: {
          claim: { type: "string" },
        },
        required: ["claim"],
        additionalProperties: false,
      },
    },
  },
];

export function runTool(name, args) {
  if (name === "get_time") return { nowMs: Date.now() };
  if (name === "math_add") return { result: Number(args.a) + Number(args.b) };

  if (name === "analyze_claim") {
    const claim = String(args.claim || "");
    const words = claim.trim().split(/\s+/).filter(Boolean).length;
    return {
      claim,
      wordCount: words,
      likelySpecific: /\d|%|because|evidence|data|study/i.test(claim),
      possibleFallacies: detectFallacies(claim),
      rewriteHint:
        "State one concrete claim, one reason, and one falsifiable test to strengthen this argument.",
    };
  }

  return { error: "Tool not allowed" };
}
