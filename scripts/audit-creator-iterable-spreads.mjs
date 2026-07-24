#!/usr/bin/env node

import { createRequire } from 'node:module';
import {
  existsSync,
  lstatSync,
  readdirSync,
  statSync,
} from 'node:fs';
import {
  dirname,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CREATOR_TYPESCRIPT_PATH = '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '..');
const DEFAULT_PROJECT_PATH = resolve(repositoryRoot, 'game/tsconfig.json');
const requireFromScript = createRequire(import.meta.url);

export function auditCreatorIterableSpreads(options = {}) {
  const projectPath = resolve(options.projectPath ?? DEFAULT_PROJECT_PATH);
  const typescriptPath = resolveTypeScriptPath(options);
  const ts = loadTypeScriptCompiler(typescriptPath);
  const projectRoot = dirname(projectPath);
  const scriptsRoot = resolve(projectRoot, 'assets/scripts');

  assertRegularFile(projectPath, 'TypeScript project');
  const sourcePaths = collectTypeScriptSources(scriptsRoot);
  if (sourcePaths.length === 0) {
    throw new Error(`no TypeScript sources found under ${scriptsRoot}`);
  }

  const parsedConfig = parseProjectConfig(ts, projectPath);
  const rootNames = uniquePaths([...parsedConfig.fileNames, ...sourcePaths]);
  const program = ts.createProgram({
    rootNames,
    options: parsedConfig.options,
    projectReferences: parsedConfig.projectReferences,
  });
  const checker = program.getTypeChecker();
  const findings = [];
  let arraySpreadCount = 0;
  let callSpreadCount = 0;

  for (const sourcePath of sourcePaths) {
    const sourceFile = program.getSourceFile(sourcePath);
    if (!sourceFile) {
      throw new Error(`TypeScript did not load audited source: ${sourcePath}`);
    }
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    visit(sourceFile, (node) => {
      if (!ts.isSpreadElement(node)) {
        return;
      }

      let kind;
      if (ts.isArrayLiteralExpression(node.parent)) {
        kind = 'array';
        arraySpreadCount += 1;
      } else if (ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent)) {
        kind = 'call';
        callSpreadCount += 1;
      } else {
        return;
      }

      const operandType = checker.getTypeAtLocation(node.expression);
      if (isArrayOrTupleType(ts, checker, operandType)) {
        return;
      }

      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      findings.push(Object.freeze({
        column: location.character + 1,
        file: toPosix(relative(projectRoot, sourcePath)),
        kind,
        line: location.line + 1,
        type: formatType(ts, checker, operandType, node.expression),
      }));
    });
  }

  findings.sort(compareLocations);
  const diagnostics = collectProjectDiagnostics(ts, program, parsedConfig.errors, projectRoot);

  return Object.freeze({
    arraySpreadCount,
    callSpreadCount,
    compilerPath: typescriptPath,
    compilerVersion: String(ts.version),
    diagnostics: Object.freeze(diagnostics),
    findings: Object.freeze(findings),
    projectPath,
    sourceFileCount: sourcePaths.length,
  });
}

function resolveTypeScriptPath(options) {
  const requestedPath = options.typescriptPath
    ?? options.env?.COCOS_CREATOR_TYPESCRIPT_PATH
    ?? options.env?.CREATOR_TYPESCRIPT_PATH
    ?? process.env.COCOS_CREATOR_TYPESCRIPT_PATH
    ?? process.env.CREATOR_TYPESCRIPT_PATH
    ?? DEFAULT_CREATOR_TYPESCRIPT_PATH;
  if (typeof requestedPath !== 'string' || requestedPath.trim().length === 0) {
    throw new Error('TypeScript compiler path must be a non-empty string');
  }
  return resolve(requestedPath);
}

function loadTypeScriptCompiler(typescriptPath) {
  assertRegularFile(typescriptPath, 'TypeScript compiler');

  let loaded;
  try {
    loaded = requireFromScript(typescriptPath);
  } catch (error) {
    throw new Error(`unable to load TypeScript compiler at ${typescriptPath}: ${error.message}`);
  }
  const ts = loaded?.default ?? loaded;
  for (const api of [
    'createProgram',
    'getPreEmitDiagnostics',
    'isArrayLiteralExpression',
    'isCallExpression',
    'isNewExpression',
    'isSpreadElement',
    'parseJsonConfigFileContent',
    'readConfigFile',
  ]) {
    if (typeof ts?.[api] !== 'function') {
      throw new Error(`TypeScript compiler at ${typescriptPath} does not expose ${api}()`);
    }
  }
  if (typeof ts.version !== 'string') {
    throw new Error(`TypeScript compiler at ${typescriptPath} does not expose its version`);
  }
  return ts;
}

function parseProjectConfig(ts, projectPath) {
  const readResult = ts.readConfigFile(projectPath, ts.sys.readFile);
  if (readResult.error) {
    throw new Error(formatSetupDiagnostic(ts, readResult.error, dirname(projectPath)));
  }
  return ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(projectPath),
    undefined,
    projectPath,
  );
}

function collectTypeScriptSources(scriptsRoot) {
  if (!existsSync(scriptsRoot) || !statSync(scriptsRoot).isDirectory()) {
    throw new Error(`Creator scripts directory does not exist: ${scriptsRoot}`);
  }

  const sourcePaths = [];
  const pendingDirectories = [scriptsRoot];
  while (pendingDirectories.length > 0) {
    const current = pendingDirectories.pop();
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const entryPath = resolve(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`symlink is not allowed in Creator scripts: ${entryPath}`);
      }
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        sourcePaths.push(entryPath);
      }
    }
  }
  sourcePaths.sort(compareText);
  return sourcePaths;
}

function uniquePaths(paths) {
  const unique = new Map();
  for (const filePath of paths) {
    const absolutePath = resolve(filePath);
    unique.set(absolutePath, absolutePath);
  }
  return [...unique.values()].sort(compareText);
}

function visit(node, inspect) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

function isArrayOrTupleType(ts, checker, type, seen = new Set()) {
  if (seen.has(type)) {
    return false;
  }
  seen.add(type);

  try {
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      return true;
    }
    if ((type.flags & ts.TypeFlags.Union) !== 0) {
      return type.types.length > 0
        && type.types.every((member) => isArrayOrTupleType(ts, checker, member, seen));
    }
    if ((type.flags & ts.TypeFlags.Intersection) !== 0) {
      return type.types.some((member) => isArrayOrTupleType(ts, checker, member, seen));
    }

    const constraint = checker.getBaseConstraintOfType?.(type) ?? type.getConstraint?.();
    return constraint !== undefined
      && constraint !== type
      && isArrayOrTupleType(ts, checker, constraint, seen);
  } finally {
    seen.delete(type);
  }
}

function formatType(ts, checker, type, location) {
  return checker.typeToString(
    type,
    location,
    ts.TypeFormatFlags.NoTruncation
      | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  ).replace(/\s+/gu, ' ').trim();
}

function collectProjectDiagnostics(ts, program, configDiagnostics, projectRoot) {
  const diagnostics = [...configDiagnostics, ...ts.getPreEmitDiagnostics(program)]
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => serializeDiagnostic(ts, diagnostic, projectRoot));
  const unique = new Map();
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.code,
      diagnostic.file ?? '',
      diagnostic.line ?? '',
      diagnostic.column ?? '',
      diagnostic.message,
    ].join('\0');
    unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics);
}

function serializeDiagnostic(ts, diagnostic, projectRoot) {
  const result = {
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  };
  if (diagnostic.file && diagnostic.start !== undefined) {
    const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    result.column = location.character + 1;
    result.file = toPosix(relative(projectRoot, diagnostic.file.fileName));
    result.line = location.line + 1;
  }
  return Object.freeze(result);
}

function formatSetupDiagnostic(ts, diagnostic, projectRoot) {
  const serialized = serializeDiagnostic(ts, diagnostic, projectRoot);
  const location = serialized.file
    ? `${serialized.file}:${serialized.line}:${serialized.column} `
    : '';
  return `${location}TS${serialized.code}: ${serialized.message}`;
}

function compareLocations(left, right) {
  return compareText(left.file, right.file)
    || left.line - right.line
    || left.column - right.column
    || compareText(left.kind, right.kind);
}

function compareDiagnostics(left, right) {
  return compareText(left.file ?? '', right.file ?? '')
    || (left.line ?? 0) - (right.line ?? 0)
    || (left.column ?? 0) - (right.column ?? 0)
    || left.code - right.code
    || compareText(left.message, right.message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosix(filePath) {
  return filePath.split(sep).join('/');
}

function assertRegularFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
  const stat = lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file: ${filePath}`);
  }
}

function parseArguments(argv) {
  let projectPath = DEFAULT_PROJECT_PATH;
  let typescriptPath;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      return Object.freeze({ help: true });
    }

    const [flag, inlineValue] = splitArgument(argument);
    if (flag === '--project' || flag === '--tsconfig') {
      const value = inlineValue ?? argv[index + 1];
      if (!value || (inlineValue === undefined && value.startsWith('-'))) {
        throw new Error(`missing value for ${flag}`);
      }
      projectPath = value;
      if (inlineValue === undefined) {
        index += 1;
      }
    } else if (flag === '--typescript' || flag === '--compiler') {
      const value = inlineValue ?? argv[index + 1];
      if (!value || (inlineValue === undefined && value.startsWith('-'))) {
        throw new Error(`missing value for ${flag}`);
      }
      typescriptPath = value;
      if (inlineValue === undefined) {
        index += 1;
      }
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return Object.freeze({ help: false, projectPath, typescriptPath });
}

function splitArgument(argument) {
  const equalsIndex = argument.indexOf('=');
  return equalsIndex === -1
    ? [argument, undefined]
    : [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
}

function printHelp() {
  console.log(`Usage: node scripts/audit-creator-iterable-spreads.mjs [options]

Options:
  --project, --tsconfig <path>       TypeScript project (default: game/tsconfig.json)
  --typescript, --compiler <path>    Creator-bundled TypeScript compiler
  -h, --help                         Show this help

Compiler environment override:
  COCOS_CREATOR_TYPESCRIPT_PATH (CREATOR_TYPESCRIPT_PATH is also accepted)

The pinned macOS default is:
  ${DEFAULT_CREATOR_TYPESCRIPT_PATH}`);
}

function printResult(result) {
  const blocked = result.diagnostics.length > 0 || result.findings.length > 0;
  if (blocked) {
    console.error('Creator iterable spread audit: BLOCKED');
    for (const diagnostic of result.diagnostics) {
      const location = diagnostic.file
        ? `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} `
        : '';
      console.error(`- ${location}TS${diagnostic.code}: ${diagnostic.message}`);
    }
    for (const finding of result.findings) {
      console.error(
        `- ${finding.file}:${finding.line}:${finding.column} `
        + `${finding.kind} spread operand type "${finding.type}" is not an array or tuple`,
      );
    }
  } else {
    console.log(
      `Creator iterable spread audit: PASS `
      + `(${result.arraySpreadCount} array spreads, ${result.callSpreadCount} call spreads; `
      + `TypeScript ${result.compilerVersion})`,
    );
  }
  return !blocked;
}

function main() {
  const cliOptions = parseArguments(process.argv.slice(2));
  if (cliOptions.help) {
    printHelp();
    return;
  }
  const result = auditCreatorIterableSpreads(cliOptions);
  if (!printResult(result)) {
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && scriptPath === resolve(process.argv[1]);
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(`Creator iterable spread audit: ERROR\n- ${error.message}`);
    process.exitCode = 1;
  }
}
