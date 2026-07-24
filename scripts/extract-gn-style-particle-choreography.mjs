#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BINARY_SHA256
  = '55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e';
const EXPECTED_CANONICAL_CSV_SHA256
  = '6c8dd814fb776e15507c2f42081b315bd410ea5b9a9156a4726c186504507c97';
const FUNCTION_START = 0x0015_1f74;
const FUNCTION_END_EXCLUSIVE = 0x0015_84bc;
const CHOREOGRAPHY_START = 0x0015_22a0;
const EXPECTED_RETURN = 0x0015_8478;
const EXPECTED_CALL_COUNT = 439;
const EXPECTED_EXECUTED_INSTRUCTION_COUNT = 10_309;
const EXPECTED_LITERAL_POOL_BRANCH_COUNT = 22;
const ADD_PARTICLE = 0x0015_1eca;
const POINT_COPY_CONSTRUCTOR = 0x001a_606e;
const POINT_FLOAT_CONSTRUCTOR = 0x001a_6068;
const VISIBLE_RECT_CENTER = 0x0016_5728;
const FLOAT_MULTIPLY = 0x003a_2398;
const LLVM_THUMB_TRIPLE = 'thumbv5te-none-linux-android';
const SYNTHETIC_STACK_POINTER = 0x1000_0000;
const SYNTHETIC_THIS_POINTER = 0x2000_0000;

const FAMILY_PATHS = Object.freeze({
  F5: 'Blades/Particles/X-Mas/xmasfive.png',
  F4: 'Blades/Particles/X-Mas/xmasfour.png',
  ST: 'Blades/Particles/stars.png',
  VN: 'Blades/Particles/VN Flag/vnflagstar.png',
  HX: 'Blades/Particles/X-Mas/xmashexa.png',
  CI: 'Blades/Particles/X-Mas/xmascircle.png',
});

const EXPECTED_FAMILY_COUNTS = Object.freeze({
  F5: 223,
  F4: 128,
  ST: 32,
  VN: 30,
  HX: 17,
  CI: 9,
});

const EXPECTED_FLAG_COUNTS = Object.freeze({
  '0,0': 341,
  '1,0': 64,
  '0,1': 34,
});

const PATH_FAMILIES = new Map(
  Object.entries(FAMILY_PATHS).map(([family, canonicalPath]) => [canonicalPath, family]),
);

const ANCHOR_X_FACTORS = Object.freeze([
  0x3dd7_0a3d,
  0x3f00_0000,
  0x3f65_1eb8,
]);
const ANCHOR_Y_FACTORS = Object.freeze([
  0x3f50_0000,
  0x3f20_0000,
  0x3ee0_0000,
  0x3e80_0000,
  0x3d80_0000,
]);

function fail(message) {
  throw new Error(message);
}

function usage() {
  return [
    'usage: node scripts/extract-gn-style-particle-choreography.mjs',
    '  <libgame.so> <output-evidence.json> <output-generated.ts>',
    '',
    'The command performs static disassembly only. It never loads or executes libgame.so.',
    'Set LLVM_OBJDUMP_BIN when llvm-objdump is not on PATH or under an Android SDK NDK.',
  ].join('\n');
}

function assertReadableFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`${label} not found: ${filePath}`);
  }
}

function assertNewOutput(filePath, label) {
  if (fs.existsSync(filePath)) {
    fail(`${label} already exists: ${filePath}`);
  }
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    fail(`${label} parent directory not found: ${parent}`);
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function llvmObjdumpCandidateUnderSdk(sdkRoot) {
  const ndkRoot = path.join(sdkRoot, 'ndk');
  if (!fs.existsSync(ndkRoot) || !fs.statSync(ndkRoot).isDirectory()) {
    return null;
  }

  const versions = fs.readdirSync(ndkRoot).sort().reverse();
  for (const version of versions) {
    const prebuiltRoot = path.join(
      ndkRoot,
      version,
      'toolchains',
      'llvm',
      'prebuilt',
    );
    if (!fs.existsSync(prebuiltRoot) || !fs.statSync(prebuiltRoot).isDirectory()) {
      continue;
    }
    for (const host of fs.readdirSync(prebuiltRoot).sort().reverse()) {
      const candidate = path.join(prebuiltRoot, host, 'bin', 'llvm-objdump');
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function resolveLlvmObjdump() {
  const override = process.env.LLVM_OBJDUMP_BIN;
  if (override !== undefined) {
    const resolved = path.resolve(override);
    if (!isExecutable(resolved)) {
      fail(`LLVM_OBJDUMP_BIN is not executable: ${resolved}`);
    }
    return resolved;
  }

  const onPath = spawnSync('llvm-objdump', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (onPath.status === 0) {
    return 'llvm-objdump';
  }

  const sdkRoots = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter((candidate, index, all) => (
    typeof candidate === 'string'
    && candidate.length > 0
    && all.indexOf(candidate) === index
  ));

  for (const sdkRoot of sdkRoots) {
    const candidate = llvmObjdumpCandidateUnderSdk(sdkRoot);
    if (candidate !== null) {
      return candidate;
    }
  }

  fail(
    'llvm-objdump not found; set LLVM_OBJDUMP_BIN, ANDROID_SDK_ROOT, or ANDROID_HOME',
  );
}

function disassembleStaticBytes(binaryPath) {
  const llvmObjdump = resolveLlvmObjdump();
  const result = spawnSync(llvmObjdump, [
    `--triple=${LLVM_THUMB_TRIPLE}`,
    `--start-address=0x${FUNCTION_START.toString(16)}`,
    `--stop-address=0x${FUNCTION_END_EXCLUSIVE.toString(16)}`,
    '-d',
    binaryPath,
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail(
      `static llvm-objdump failed with status ${String(result.status)}: ${result.stderr.trim()}`,
    );
  }
  if (!result.stdout.includes('file format elf32-littlearm')) {
    fail('llvm-objdump did not identify the pinned input as elf32-littlearm');
  }
  return result.stdout;
}

function parseInstructions(disassembly) {
  const instructions = new Map();
  const instructionPattern
    = /^\s*([0-9a-f]+):\s+([0-9a-f]{4}(?:\s+[0-9a-f]{4})?)\s+\t(\S+)(?:\t(.*))?$/i;

  for (const line of disassembly.split(/\r?\n/)) {
    const match = line.match(instructionPattern);
    if (match === null) {
      continue;
    }
    const address = Number.parseInt(match[1], 16);
    const rawHalfwords = match[2].trim().split(/\s+/);
    const mnemonic = match[3];
    const operands = (match[4] ?? '').split(/\s+@\s+/, 1)[0].trim();
    if (instructions.has(address)) {
      fail(`duplicate disassembly address 0x${hex(address)}`);
    }
    instructions.set(address, Object.freeze({
      address,
      mnemonic,
      operands,
      size: rawHalfwords.length * 2,
    }));
  }

  if (!instructions.has(FUNCTION_START) || !instructions.has(EXPECTED_RETURN)) {
    fail('disassembly does not cover the pinned GN Style function bounds');
  }
  return instructions;
}

function elfLoadSegments(binary) {
  if (
    binary.length < 52
    || binary[0] !== 0x7f
    || binary.toString('ascii', 1, 4) !== 'ELF'
    || binary[4] !== 1
    || binary[5] !== 1
  ) {
    fail('pinned native input must be a little-endian ELF32 image');
  }

  const programHeaderOffset = binary.readUInt32LE(28);
  const programHeaderEntrySize = binary.readUInt16LE(42);
  const programHeaderCount = binary.readUInt16LE(44);
  if (programHeaderEntrySize < 32) {
    fail(`ELF program-header entry size is unsupported: ${programHeaderEntrySize}`);
  }

  const segments = [];
  for (let index = 0; index < programHeaderCount; index += 1) {
    const offset = programHeaderOffset + (index * programHeaderEntrySize);
    if (offset + programHeaderEntrySize > binary.length) {
      fail('ELF program-header table extends beyond the input bytes');
    }
    if (binary.readUInt32LE(offset) !== 1) {
      continue;
    }
    const fileOffset = binary.readUInt32LE(offset + 4);
    const virtualAddress = binary.readUInt32LE(offset + 8);
    const fileSize = binary.readUInt32LE(offset + 16);
    if (fileOffset + fileSize > binary.length) {
      fail('ELF load segment extends beyond the input bytes');
    }
    segments.push(Object.freeze({ fileOffset, fileSize, virtualAddress }));
  }
  if (segments.length === 0) {
    fail('ELF input has no loadable segments');
  }
  return Object.freeze(segments);
}

function virtualToFileOffset(segments, virtualAddress, byteCount) {
  for (const segment of segments) {
    const delta = virtualAddress - segment.virtualAddress;
    if (delta >= 0 && delta + byteCount <= segment.fileSize) {
      return segment.fileOffset + delta;
    }
  }
  fail(
    `virtual address range 0x${hex(virtualAddress)}..0x${hex(virtualAddress + byteCount)} is not file-backed`,
  );
}

function readVirtualWord(binary, segments, virtualAddress) {
  return binary.readUInt32LE(virtualToFileOffset(segments, virtualAddress, 4));
}

function readVirtualCString(binary, segments, virtualAddress) {
  const start = virtualToFileOffset(segments, virtualAddress, 1);
  let end = start;
  while (end < binary.length && binary[end] !== 0) {
    end += 1;
  }
  if (end === binary.length) {
    fail(`unterminated C string at virtual address 0x${hex(virtualAddress)}`);
  }
  const value = binary.toString('utf8', start, end);
  if (!/^[\x20-\x7e]+$/.test(value)) {
    fail(`non-ASCII particle path at virtual address 0x${hex(virtualAddress)}`);
  }
  return value;
}

function hex(value) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function hexWord(value) {
  return `0x${hex(value)}`;
}

function splitOperands(operandsText) {
  if (operandsText.length === 0) {
    return [];
  }
  const operands = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < operandsText.length; index += 1) {
    const character = operandsText[index];
    if (character === '[' || character === '{') {
      depth += 1;
    } else if (character === ']' || character === '}') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      operands.push(operandsText.slice(start, index).trim());
      start = index + 1;
    }
  }
  operands.push(operandsText.slice(start).trim());
  if (depth !== 0 || operands.some((operand) => operand.length === 0)) {
    fail(`cannot parse operands: ${operandsText}`);
  }
  return operands;
}

function parseImmediate(operand) {
  const match = operand.match(/^#(-?(?:0x[0-9a-f]+|\d+))/i);
  if (match === null) {
    fail(`expected immediate operand, got ${operand}`);
  }
  const sign = match[1].startsWith('-') ? -1 : 1;
  const magnitude = match[1].replace(/^-/, '');
  const value = Number.parseInt(magnitude, magnitude.startsWith('0x') ? 16 : 10);
  return sign * value;
}

function parseTarget(operand) {
  const match = operand.match(/^0x([0-9a-f]+)/i);
  if (match === null) {
    fail(`expected branch target, got ${operand}`);
  }
  return Number.parseInt(match[1], 16);
}

function isRegister(operand) {
  return /^(?:r(?:1[0-2]|[0-9])|sp|lr|pc)$/.test(operand);
}

function axisFactor(axis, factorBits) {
  return Object.freeze({ kind: 'axis-factor', axis, factorBits: factorBits >>> 0 });
}

function isAxisFactor(value) {
  return typeof value === 'object' && value !== null && value.kind === 'axis-factor';
}

function assertNumber(value, context) {
  if (typeof value !== 'number') {
    fail(`${context} requires a resolved integer/address value`);
  }
  return value >>> 0;
}

function floatFromBits(bits) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits >>> 0, true);
  return view.getFloat32(0, true);
}

function bitsFromFloat(value) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, Math.fround(value), true);
  return view.getUint32(0, true);
}

function multiplyFloatValues(left, right) {
  if (isAxisFactor(left) && isAxisFactor(right)) {
    fail('native float multiply unexpectedly combines two viewport-axis factors');
  }
  if (isAxisFactor(left)) {
    return axisFactor(
      left.axis,
      bitsFromFloat(
        Math.fround(floatFromBits(left.factorBits) * floatFromBits(assertNumber(right, 'float multiply'))),
      ),
    );
  }
  if (isAxisFactor(right)) {
    return axisFactor(
      right.axis,
      bitsFromFloat(
        Math.fround(floatFromBits(assertNumber(left, 'float multiply')) * floatFromBits(right.factorBits)),
      ),
    );
  }
  return bitsFromFloat(
    Math.fround(
      floatFromBits(assertNumber(left, 'float multiply'))
        * floatFromBits(assertNumber(right, 'float multiply')),
    ),
  );
}

function createAnchorPoints() {
  const points = new Map();
  let ordinal = 1;
  for (const yFactorBits of ANCHOR_Y_FACTORS) {
    for (const xFactorBits of ANCHOR_X_FACTORS) {
      const id = `A${String(ordinal).padStart(2, '0')}`;
      const address = SYNTHETIC_STACK_POINTER + 0xed0 + ((ordinal - 1) * 8);
      points.set(address >>> 0, Object.freeze({
        id,
        kind: 'reusable-anchor',
        xFactorBits,
        yFactorBits,
      }));
      ordinal += 1;
    }
  }
  return points;
}

function effectiveAddress(operand, registers, instructionAddress) {
  const match = operand.match(/^\[([^\]]+)\]$/);
  if (match === null) {
    fail(`expected memory operand, got ${operand}`);
  }
  const parts = match[1].split(',').map((part) => part.trim());
  const baseName = parts[0];
  if (!isRegister(baseName)) {
    fail(`unsupported memory base register: ${baseName}`);
  }
  const base = baseName === 'pc'
    ? ((instructionAddress + 4) & ~3)
    : assertNumber(registers.get(baseName), `memory base ${baseName}`);
  if (parts.length === 1) {
    return base >>> 0;
  }
  if (parts.length !== 2) {
    fail(`unsupported memory address expression: ${operand}`);
  }
  const offset = parts[1].startsWith('#')
    ? parseImmediate(parts[1])
    : assertNumber(registers.get(parts[1]), `memory offset ${parts[1]}`);
  return (base + offset) >>> 0;
}

function executeChoreography(instructions, binary, segments) {
  const registers = new Map([
    ['r4', 0],
    ['r5', 0],
    ['r6', SYNTHETIC_THIS_POINTER],
    ['sp', SYNTHETIC_STACK_POINTER],
  ]);
  const memory = new Map([
    [SYNTHETIC_STACK_POINTER + 0x38, axisFactor('x', 0x3f80_0000)],
    [SYNTHETIC_STACK_POINTER + 0x3c, axisFactor('y', 0x3f80_0000)],
  ]);
  const points = createAnchorPoints();
  const calls = [];
  let nextDynamicPointOrdinal = 1;
  let pc = CHOREOGRAPHY_START;
  let executedInstructionCount = 0;
  let literalPoolBranchCount = 0;

  const getRegister = (register, context) => {
    if (register === 'pc') {
      return (pc + 4) >>> 0;
    }
    if (!registers.has(register)) {
      fail(`${context} reads unresolved register ${register} at 0x${hex(pc)}`);
    }
    return registers.get(register);
  };
  const setRegister = (register, value) => {
    if (register === 'pc') {
      fail(`direct write to pc is unsupported at 0x${hex(pc)}`);
    }
    registers.set(register, value);
  };
  const clobberCallerRegisters = (returnValue) => {
    registers.delete('r0');
    registers.delete('r1');
    registers.delete('r2');
    registers.delete('r3');
    if (returnValue !== undefined) {
      registers.set('r0', returnValue);
    }
  };

  while (true) {
    if (pc < CHOREOGRAPHY_START || pc >= FUNCTION_END_EXCLUSIVE) {
      fail(`control flow escaped pinned function bounds at 0x${hex(pc)}`);
    }
    const instruction = instructions.get(pc);
    if (instruction === undefined) {
      fail(`no decoded instruction at reachable address 0x${hex(pc)}`);
    }
    executedInstructionCount += 1;
    const operands = splitOperands(instruction.operands);
    let nextPc = pc + instruction.size;

    switch (instruction.mnemonic) {
      case 'mov':
      case 'movs': {
        if (operands.length !== 2 || !isRegister(operands[0])) {
          fail(`unsupported ${instruction.mnemonic} at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const value = operands[1].startsWith('#')
          ? parseImmediate(operands[1]) >>> 0
          : getRegister(operands[1], instruction.mnemonic);
        setRegister(operands[0], value);
        break;
      }
      case 'add':
      case 'adds':
      case 'sub':
      case 'subs': {
        if ((operands.length !== 2 && operands.length !== 3) || !isRegister(operands[0])) {
          fail(`unsupported ${instruction.mnemonic} at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const sourceName = operands.length === 3 ? operands[1] : operands[0];
        const rightOperand = operands.length === 3 ? operands[2] : operands[1];
        const right = rightOperand.startsWith('#')
          ? parseImmediate(rightOperand)
          : assertNumber(
            getRegister(rightOperand, `${instruction.mnemonic} at 0x${hex(pc)}`),
            `${instruction.mnemonic} at 0x${hex(pc)}`,
          );
        const isSubtract = instruction.mnemonic.startsWith('sub');
        const source = getRegister(
          sourceName,
          `${instruction.mnemonic} at 0x${hex(pc)}`,
        );
        if (!isSubtract && right === 0) {
          setRegister(operands[0], source);
          break;
        }
        const left = assertNumber(
          source,
          `${instruction.mnemonic} at 0x${hex(pc)}`,
        );
        setRegister(operands[0], (isSubtract ? left - right : left + right) >>> 0);
        break;
      }
      case 'lsl':
      case 'lsls': {
        if ((operands.length !== 2 && operands.length !== 3) || !isRegister(operands[0])) {
          fail(`unsupported ${instruction.mnemonic} at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const sourceName = operands.length === 3 ? operands[1] : operands[0];
        const shiftOperand = operands.length === 3 ? operands[2] : operands[1];
        const value = assertNumber(getRegister(sourceName, instruction.mnemonic), instruction.mnemonic);
        const shift = shiftOperand.startsWith('#')
          ? parseImmediate(shiftOperand)
          : assertNumber(getRegister(shiftOperand, instruction.mnemonic), instruction.mnemonic);
        setRegister(operands[0], (value << (shift & 0xff)) >>> 0);
        break;
      }
      case 'ldr': {
        if (operands.length !== 2 || !isRegister(operands[0])) {
          fail(`unsupported ldr at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const address = effectiveAddress(operands[1], registers, pc);
        const value = operands[1].startsWith('[pc')
          ? readVirtualWord(binary, segments, address)
          : memory.get(address);
        if (value === undefined) {
          fail(`ldr reads unresolved memory at 0x${hex(address)} from 0x${hex(pc)}`);
        }
        setRegister(operands[0], value);
        break;
      }
      case 'str': {
        if (operands.length !== 2 || !isRegister(operands[0])) {
          fail(`unsupported str at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const address = effectiveAddress(operands[1], registers, pc);
        memory.set(address, getRegister(operands[0], 'str'));
        break;
      }
      case 'b': {
        if (operands.length !== 1) {
          fail(`unsupported branch at 0x${hex(pc)}: ${instruction.operands}`);
        }
        nextPc = parseTarget(operands[0]);
        if (nextPc <= pc) {
          fail(`unexpected backward branch from 0x${hex(pc)} to 0x${hex(nextPc)}`);
        }
        literalPoolBranchCount += 1;
        break;
      }
      case 'bl':
      case 'blx': {
        if (operands.length !== 1) {
          fail(`unsupported call at 0x${hex(pc)}: ${instruction.operands}`);
        }
        const target = parseTarget(operands[0]) & ~1;
        if (target === ADD_PARTICLE) {
          const pointPointer = assertNumber(
            memory.get(SYNTHETIC_STACK_POINTER + 0x0c),
            'AddParticle point pointer',
          );
          const point = points.get(pointPointer);
          if (point === undefined) {
            fail(`AddParticle references unresolved point at 0x${hex(pointPointer)}`);
          }
          const pathPointer = assertNumber(
            memory.get(SYNTHETIC_STACK_POINTER + 0x10),
            'AddParticle path pointer',
          );
          const canonicalPath = readVirtualCString(binary, segments, pathPointer);
          const family = PATH_FAMILIES.get(canonicalPath);
          if (family === undefined) {
            fail(`AddParticle references unknown path: ${canonicalPath}`);
          }
          const flagA = assertNumber(
            memory.get(SYNTHETIC_STACK_POINTER + 0x14),
            'AddParticle flagA',
          );
          const flagB = assertNumber(
            memory.get(SYNTHETIC_STACK_POINTER + 0x18),
            'AddParticle flagB',
          );
          if ((flagA !== 0 && flagA !== 1) || (flagB !== 0 && flagB !== 1)) {
            fail(`AddParticle flags must be raw booleans at 0x${hex(pc)}`);
          }
          calls.push(Object.freeze({
            ordinal: calls.length + 1,
            callSite: pc,
            minimumDistance: assertNumber(getRegister('r1', 'AddParticle'), 'minimumDistance'),
            maximumDistance: assertNumber(getRegister('r2', 'AddParticle'), 'maximumDistance'),
            minimumDurationBits: assertNumber(getRegister('r3', 'AddParticle'), 'minimumDurationBits'),
            maximumDurationBits: assertNumber(
              memory.get(SYNTHETIC_STACK_POINTER),
              'maximumDurationBits',
            ),
            particleCount: assertNumber(
              memory.get(SYNTHETIC_STACK_POINTER + 0x04),
              'particleCount',
            ),
            startDelayBits: assertNumber(
              memory.get(SYNTHETIC_STACK_POINTER + 0x08),
              'startDelayBits',
            ),
            point,
            family,
            canonicalPath,
            flagA,
            flagB,
          }));
          clobberCallerRegisters();
        } else if (target === POINT_COPY_CONSTRUCTOR) {
          const destination = assertNumber(getRegister('r0', 'CCPoint copy destination'), 'CCPoint copy destination');
          const source = assertNumber(getRegister('r1', 'CCPoint copy source'), 'CCPoint copy source');
          const point = points.get(source);
          if (point === undefined) {
            fail(`CCPoint copy reads unresolved point at 0x${hex(source)}`);
          }
          points.set(destination, point);
          clobberCallerRegisters(destination);
        } else if (target === POINT_FLOAT_CONSTRUCTOR) {
          const destination = assertNumber(
            getRegister('r0', 'CCPoint float destination'),
            'CCPoint float destination',
          );
          const x = getRegister('r1', 'CCPoint float x');
          const y = getRegister('r2', 'CCPoint float y');
          if (!isAxisFactor(x) || x.axis !== 'x' || !isAxisFactor(y) || y.axis !== 'y') {
            fail(`CCPoint float constructor lost viewport-factor identity at 0x${hex(pc)}`);
          }
          const point = Object.freeze({
            id: `D${String(nextDynamicPointOrdinal).padStart(2, '0')}`,
            kind: 'direct-construction',
            xFactorBits: x.factorBits,
            yFactorBits: y.factorBits,
          });
          nextDynamicPointOrdinal += 1;
          points.set(destination, point);
          clobberCallerRegisters(destination);
        } else if (target === VISIBLE_RECT_CENTER) {
          const destination = assertNumber(
            getRegister('r0', 'VisibleRect center destination'),
            'VisibleRect center destination',
          );
          memory.set(destination, axisFactor('x', 0x3f00_0000));
          memory.set(destination + 4, axisFactor('y', 0x3f00_0000));
          clobberCallerRegisters(destination);
        } else if (target === FLOAT_MULTIPLY) {
          const result = multiplyFloatValues(
            getRegister('r0', 'float multiply left'),
            getRegister('r1', 'float multiply right'),
          );
          clobberCallerRegisters(result);
        } else {
          fail(`unsupported reachable call target 0x${hex(target)} at 0x${hex(pc)}`);
        }
        break;
      }
      case 'pop': {
        if (
          pc !== EXPECTED_RETURN
          || instruction.operands.replace(/\s/g, '') !== '{r4,r5,r6,r7,pc}'
        ) {
          fail(`unexpected reachable pop at 0x${hex(pc)}: ${instruction.operands}`);
        }
        if (calls.length !== EXPECTED_CALL_COUNT) {
          fail(
            `particle call count mismatch: actual=${calls.length} expected=${EXPECTED_CALL_COUNT}`,
          );
        }
        if (nextDynamicPointOrdinal !== 17) {
          fail(
            `dynamic point count mismatch: actual=${nextDynamicPointOrdinal - 1} expected=16`,
          );
        }
        return Object.freeze({
          calls: Object.freeze(calls),
          executedInstructionCount,
          literalPoolBranchCount,
        });
      }
      default:
        fail(
          `unsupported reachable instruction ${instruction.mnemonic} at 0x${hex(pc)}: ${instruction.operands}`,
        );
    }

    pc = nextPc >>> 0;
  }
}

function canonicalCsv(calls) {
  const rows = [
    'i,pc,minD,maxD,minDurBits,maxDurBits,count,delayBits,point,path,flagA,flagB',
  ];
  for (const call of calls) {
    rows.push([
      call.ordinal,
      hex(call.callSite).replace(/^00/, ''),
      call.minimumDistance,
      call.maximumDistance,
      hex(call.minimumDurationBits),
      hex(call.maximumDurationBits),
      call.particleCount,
      hex(call.startDelayBits),
      call.point.id,
      call.family,
      call.flagA,
      call.flagB,
    ].join(','));
  }
  return `${rows.join('\n')}\n`;
}

function countBy(calls, selector) {
  const counts = {};
  for (const call of calls) {
    const key = selector(call);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertExactCounts(actual, expected, label) {
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    fail(`${label} mismatch: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}

function validateExtractedContract(execution) {
  const { calls, executedInstructionCount, literalPoolBranchCount } = execution;
  if (executedInstructionCount !== EXPECTED_EXECUTED_INSTRUCTION_COUNT) {
    fail(
      `executed instruction count mismatch: actual=${executedInstructionCount} expected=${EXPECTED_EXECUTED_INSTRUCTION_COUNT}`,
    );
  }
  if (literalPoolBranchCount !== EXPECTED_LITERAL_POOL_BRANCH_COUNT) {
    fail(
      `literal-pool branch count mismatch: actual=${literalPoolBranchCount} expected=${EXPECTED_LITERAL_POOL_BRANCH_COUNT}`,
    );
  }

  const callSites = new Set(calls.map((call) => call.callSite));
  if (callSites.size !== EXPECTED_CALL_COUNT) {
    fail(`call-site uniqueness mismatch: actual=${callSites.size} expected=${EXPECTED_CALL_COUNT}`);
  }
  for (let index = 0; index < calls.length; index += 1) {
    if (calls[index].ordinal !== index + 1) {
      fail(`particle ordinal is not source ordered at index ${index}`);
    }
    if (index > 0 && calls[index - 1].callSite >= calls[index].callSite) {
      fail(`particle call sites are not strictly source ordered at ordinal ${index + 1}`);
    }
  }

  assertExactCounts(
    countBy(calls, (call) => call.family),
    EXPECTED_FAMILY_COUNTS,
    'family counts',
  );
  assertExactCounts(
    countBy(calls, (call) => `${call.flagA},${call.flagB}`),
    EXPECTED_FLAG_COUNTS,
    'flag-pair counts',
  );

  const anchorCount = calls.filter((call) => call.point.kind === 'reusable-anchor').length;
  const directCount = calls.filter((call) => call.point.kind === 'direct-construction').length;
  if (anchorCount !== 423 || directCount !== 16) {
    fail(`point-kind counts mismatch: anchors=${anchorCount} direct=${directCount}`);
  }

  const csv = canonicalCsv(calls);
  const csvSha256 = sha256(csv);
  if (csvSha256 !== EXPECTED_CANONICAL_CSV_SHA256) {
    fail(
      `canonical CSV SHA-256 mismatch: actual=${csvSha256} expected=${EXPECTED_CANONICAL_CSV_SHA256}`,
    );
  }
  return Object.freeze({ csv, csvSha256 });
}

function evidenceJson(execution, csvSha256) {
  const calls = execution.calls.map((call) => ({
    ordinal: call.ordinal,
    callSite: hexWord(call.callSite),
    raw: {
      minimumDistance: call.minimumDistance,
      maximumDistance: call.maximumDistance,
      minimumDurationBits: hexWord(call.minimumDurationBits),
      maximumDurationBits: hexWord(call.maximumDurationBits),
      particleCount: call.particleCount,
      startDelayBits: hexWord(call.startDelayBits),
    },
    point: {
      id: call.point.id,
      kind: call.point.kind,
      xFactorBits: hexWord(call.point.xFactorBits),
      yFactorBits: hexWord(call.point.yFactorBits),
    },
    family: call.family,
    canonicalPath: call.canonicalPath,
    flags: {
      flagA: call.flagA,
      flagB: call.flagB,
    },
  }));

  return {
    schemaVersion: 1,
    evidenceStatus: 'recovered',
    extraction: {
      method: 'static Thumb disassembly interpretation; native input never loaded or executed',
      binarySha256: EXPECTED_BINARY_SHA256,
      functionBounds: {
        start: hexWord(FUNCTION_START),
        endExclusive: hexWord(FUNCTION_END_EXCLUSIVE),
      },
      choreographyStart: hexWord(CHOREOGRAPHY_START),
      expectedCalls: EXPECTED_CALL_COUNT,
      executedInstructionCount: execution.executedInstructionCount,
      literalPoolBranchCount: execution.literalPoolBranchCount,
      canonicalCsvSha256: csvSha256,
    },
    families: Object.fromEntries(
      Object.entries(FAMILY_PATHS).map(([family, canonicalPath]) => [
        family,
        {
          canonicalPath,
          callCount: EXPECTED_FAMILY_COUNTS[family],
        },
      ]),
    ),
    summary: {
      callCount: EXPECTED_CALL_COUNT,
      uniqueCallSiteCount: EXPECTED_CALL_COUNT,
      reusableAnchorCallCount: 423,
      directConstructionCallCount: 16,
      flagPairCounts: EXPECTED_FLAG_COUNTS,
      minimumStartDelayBits: '0x40400000',
      maximumStartDelayBits: '0x43128000',
      sourceOrderDelayDecreaseCount: 25,
    },
    calls,
  };
}

function generatedTypeScript(calls) {
  const tupleRows = calls.map((call) => [
    '  Object.freeze([',
    String(call.minimumDistance),
    ', ',
    String(call.maximumDistance),
    ', ',
    hexWord(call.minimumDurationBits),
    ', ',
    hexWord(call.maximumDurationBits),
    ', ',
    String(call.particleCount),
    ', ',
    hexWord(call.startDelayBits),
    ", '",
    call.point.id,
    "', ",
    hexWord(call.point.xFactorBits),
    ', ',
    hexWord(call.point.yFactorBits),
    ", '",
    call.family,
    "', ",
    String(call.flagA),
    ', ',
    String(call.flagB),
    '] as const),',
  ].join(''));

  return [
    '/* This file is generated by scripts/extract-gn-style-particle-choreography.mjs. */',
    '/* Do not hand-edit. Raw float32 words and source order are part of the contract. */',
    '',
    "export type GnStyleParticleFamily = 'F5' | 'F4' | 'ST' | 'VN' | 'HX' | 'CI';",
    "export type GnStyleParticlePointId = `A${string}` | `D${string}`;",
    '',
    'export type GnStyleGeneratedParticleTuple = readonly [',
    '  minimumDistance: number,',
    '  maximumDistance: number,',
    '  minimumDurationBits: number,',
    '  maximumDurationBits: number,',
    '  particleCount: number,',
    '  startDelayBits: number,',
    '  pointId: GnStyleParticlePointId,',
    '  pointXFactorBits: number,',
    '  pointYFactorBits: number,',
    '  family: GnStyleParticleFamily,',
    '  flagA: 0 | 1,',
    '  flagB: 0 | 1,',
    '];',
    '',
    'export const GN_STYLE_PARTICLE_FAMILY_PATHS: Readonly<Record<',
    '  GnStyleParticleFamily,',
    '  string',
    '>> = Object.freeze({',
    `  F5: '${FAMILY_PATHS.F5}',`,
    `  F4: '${FAMILY_PATHS.F4}',`,
    `  ST: '${FAMILY_PATHS.ST}',`,
    `  VN: '${FAMILY_PATHS.VN}',`,
    `  HX: '${FAMILY_PATHS.HX}',`,
    `  CI: '${FAMILY_PATHS.CI}',`,
    '});',
    '',
    'export const GN_STYLE_GENERATED_PARTICLE_TUPLES: readonly GnStyleGeneratedParticleTuple[]',
    '  = Object.freeze([',
    ...tupleRows,
    '  ]);',
    '',
  ].join('\n');
}

function writeOutputs(evidencePath, generatedPath, evidence, generated) {
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    fs.writeFileSync(generatedPath, generated, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    fs.rmSync(evidencePath);
    throw error;
  }
}

function main(argv) {
  if (argv.length !== 5) {
    fail(usage());
  }
  const binaryPath = path.resolve(argv[2]);
  const evidencePath = path.resolve(argv[3]);
  const generatedPath = path.resolve(argv[4]);
  assertReadableFile(binaryPath, 'pinned native input');
  assertNewOutput(evidencePath, 'evidence JSON output');
  assertNewOutput(generatedPath, 'generated TypeScript output');
  if (evidencePath === generatedPath || binaryPath === evidencePath || binaryPath === generatedPath) {
    fail('input and output paths must be distinct');
  }

  const binary = fs.readFileSync(binaryPath);
  const binarySha256 = sha256(binary);
  if (binarySha256 !== EXPECTED_BINARY_SHA256) {
    fail(
      `native SHA-256 mismatch: actual=${binarySha256} expected=${EXPECTED_BINARY_SHA256}`,
    );
  }

  const segments = elfLoadSegments(binary);
  const disassembly = disassembleStaticBytes(binaryPath);
  const instructions = parseInstructions(disassembly);
  const execution = executeChoreography(instructions, binary, segments);
  const { csvSha256 } = validateExtractedContract(execution);
  const evidence = evidenceJson(execution, csvSha256);
  const generated = generatedTypeScript(execution.calls);
  writeOutputs(evidencePath, generatedPath, evidence, generated);
}

try {
  main(process.argv);
} catch (error) {
  console.error(`ERROR: ${String(error instanceof Error ? error.message : error)}`);
  process.exit(1);
}
