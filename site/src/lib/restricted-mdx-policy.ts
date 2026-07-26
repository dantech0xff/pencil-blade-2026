interface MdxAttribute {
  name?: string;
  type?: string;
  value?: unknown;
}

interface MdxNode {
  type?: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdxAttribute[];
  children?: MdxNode[];
}

interface RestrictedMdxOptions {
  allowedComponents?: readonly string[];
}

const DEFAULT_ALLOWED_COMPONENTS = Object.freeze([
  "ApkDissection",
  "CodeLens",
  "DecisionPatch",
  "EvidenceChain",
  "EvidenceRef",
  "EvidenceStatus",
  "MetricLedger",
  "NativeContractTrace",
  "ProofFigure",
  "ReconstructionMap",
  "RightsBoundary",
  "RuntimeProofMatrix",
  "SixModeAtlas",
]);

const EXECUTABLE_NODE_TYPES = new Set([
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
  "html",
]);

const JSX_NODE_TYPES = new Set([
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
]);

const URL_ATTRIBUTE_NAMES = new Set([
  "action",
  "formaction",
  "href",
  "poster",
  "src",
  "xlink:href",
]);

const RESOURCE_URL_ATTRIBUTES = new Set(["poster", "src"]);
const DANGEROUS_SCHEME = /^(?:data|javascript|vbscript):/iu;
const EXTERNAL_SCHEME = /^(?:https?:)?\/\//iu;

function policyError(message: string): Error {
  const error = new Error(`Restricted MDX policy: ${message}`);
  error.name = "RestrictedMdxPolicyError";
  return error;
}

function validateUrl(attributeName: string, value: unknown): void {
  if (typeof value !== "string") {
    throw policyError(
      `attribute "${attributeName}" must use a literal string value`,
    );
  }

  const normalized = value.trim();
  if (DANGEROUS_SCHEME.test(normalized)) {
    throw policyError(
      `attribute "${attributeName}" uses a dangerous URL scheme`,
    );
  }
  if (
    RESOURCE_URL_ATTRIBUTES.has(attributeName)
    && EXTERNAL_SCHEME.test(normalized)
  ) {
    throw policyError(
      `resource attribute "${attributeName}" may not request an external URL`,
    );
  }
}

function validateJsxNode(
  node: MdxNode,
  allowedComponents: ReadonlySet<string>,
): void {
  if (!node.name || !allowedComponents.has(node.name)) {
    throw policyError(
      `component "${node.name ?? "(fragment)"}" is not allowlisted`,
    );
  }

  for (const attribute of node.attributes ?? []) {
    if (attribute.type === "mdxJsxExpressionAttribute" || !attribute.name) {
      throw policyError("spread and expression attributes are prohibited");
    }

    const attributeName = attribute.name.toLowerCase();
    if (
      attributeName.startsWith("on")
      || attributeName === "set:html"
      || attributeName === "is:raw"
    ) {
      throw policyError(`attribute "${attribute.name}" is prohibited`);
    }
    if (
      attribute.value
      && typeof attribute.value === "object"
      && "type" in attribute.value
    ) {
      throw policyError(
        `attribute "${attribute.name}" may not contain an expression`,
      );
    }
    if (URL_ATTRIBUTE_NAMES.has(attributeName)) {
      validateUrl(attributeName, attribute.value ?? "");
    }
  }
}

export function assertRestrictedMdxTree(
  tree: MdxNode,
  options: RestrictedMdxOptions = {},
): void {
  const allowedComponents = new Set(
    options.allowedComponents ?? DEFAULT_ALLOWED_COMPONENTS,
  );

  const inspect = (node: MdxNode): void => {
    if (EXECUTABLE_NODE_TYPES.has(node.type ?? "")) {
      throw policyError(`node type "${node.type}" is prohibited`);
    }
    if (JSX_NODE_TYPES.has(node.type ?? "")) {
      validateJsxNode(node, allowedComponents);
    }
    for (const child of node.children ?? []) {
      inspect(child);
    }
  };

  inspect(tree);
}

/**
 * Remark plugin used before Astro compiles MDX. It rejects executable syntax
 * rather than trying to sanitize generated HTML.
 */
export function restrictedMdxPolicy(
  options: RestrictedMdxOptions = {},
): (tree: MdxNode) => void {
  return (tree: MdxNode): void => {
    assertRestrictedMdxTree(tree, options);
  };
}
