#!/usr/bin/env node

import fs from 'node:fs';
import readline from 'node:readline';

const EXPECTED_HEADER = [
  'raw_address',
  'instruction_address',
  'thumb',
  'size_bytes',
  'mangled_symbol',
  'demangled_symbol',
  'ownership',
  'subsystem',
  'confidence',
  'evidence_ids',
];

const ENRICHED_FIELDS = [
  'direct_call_count',
  'direct_calls_json',
  'numeric_constant_count',
  'numeric_constants_json',
  'string_xref_count',
  'string_xrefs_json',
  'review_state',
];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function parseCsvRecord(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) fail('unterminated CSV field');
  values.push(value);
  return values;
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function hex(value) {
  return `0x${value.toString(16).padStart(8, '0')}`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readFunctionRows(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trimEnd().split('\n');
  const header = parseCsvRecord(lines.shift() ?? '');
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) {
    fail(`unexpected application inventory header: ${header.join(',')}`);
  }
  const rows = lines.map((line, index) => {
    const fields = parseCsvRecord(line);
    if (fields.length !== EXPECTED_HEADER.length) {
      fail(`application inventory row ${index + 2} has ${fields.length} fields`);
    }
    const values = Object.fromEntries(
      EXPECTED_HEADER.map((name, fieldIndex) => [name, fields[fieldIndex]]),
    );
    const start = Number.parseInt(values.instruction_address, 16);
    const size = Number.parseInt(values.size_bytes, 10);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) || size <= 0) {
      fail(`application inventory row ${index + 2} has an invalid range`);
    }
    return {
      fields,
      start,
      end: start + size,
      calls: new Map(),
      constants: new Set(),
      registerLiterals: new Map(),
      stringXrefs: new Map(),
    };
  });
  rows.sort((left, right) => left.start - right.start || left.end - right.end);
  return rows;
}

function readLoadSegments(filePath) {
  const segments = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(
      /^\s*LOAD\s+0x([0-9a-f]+)\s+0x([0-9a-f]+)\s+0x[0-9a-f]+\s+0x([0-9a-f]+)/i,
    );
    if (match === null) continue;
    const fileOffset = Number.parseInt(match[1], 16);
    const virtualAddress = Number.parseInt(match[2], 16);
    const fileSize = Number.parseInt(match[3], 16);
    segments.push({
      fileOffset,
      virtualAddress,
      virtualEnd: virtualAddress + fileSize,
    });
  }
  if (segments.length === 0) fail('no LOAD segments found in GNU program headers');
  return segments;
}

function virtualToFileOffset(segments, address) {
  const segment = segments.find(
    ({ virtualAddress, virtualEnd }) => address >= virtualAddress && address < virtualEnd,
  );
  return segment === undefined
    ? null
    : segment.fileOffset + (address - segment.virtualAddress);
}

function readStringSections(filePath) {
  const sections = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(
      /^\s*\[\s*\d+\]\s+(\S+)\s+(\S+)\s+([0-9a-f]+)\s+[0-9a-f]+\s+([0-9a-f]+)\s+\S+\s+([A-Z]+)/i,
    );
    if (match === null || match[2] === 'NOBITS') continue;
    const flags = match[5].toUpperCase();
    if (!flags.includes('A') || flags.includes('X')) continue;
    const start = Number.parseInt(match[3], 16);
    sections.push({
      name: match[1],
      start,
      end: start + Number.parseInt(match[4], 16),
    });
  }
  if (sections.length === 0) fail('no allocated non-executable string sections found');
  return sections;
}

function readStrings(filePath, segments, stringSections) {
  const stringsByVirtualAddress = new Map();
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([0-9a-f]+)\s+(.*)$/i);
    if (match === null) continue;
    const fileOffset = Number.parseInt(match[1], 16);
    const segment = segments.find(
      ({ fileOffset: start, virtualEnd, virtualAddress }) => (
        fileOffset >= start
        && fileOffset < start + (virtualEnd - virtualAddress)
      ),
    );
    if (segment === undefined) continue;
    const virtualAddress = segment.virtualAddress + (fileOffset - segment.fileOffset);
    if (!stringSections.some(({ start, end }) => virtualAddress >= start && virtualAddress < end)) {
      continue;
    }
    stringsByVirtualAddress.set(virtualAddress, match[2]);
  }
  return stringsByVirtualAddress;
}

function matchingRows(activeRows, instructionAddress) {
  return activeRows.filter(
    ({ start, end }) => instructionAddress >= start && instructionAddress < end,
  );
}

async function enrich({
  binaryPath,
  disassemblyPath,
  inputPath,
  outputPath,
  programHeadersPath,
  sectionsPath,
  summaryPath,
  stringsPath,
}) {
  const rows = readFunctionRows(inputPath);
  const segments = readLoadSegments(programHeadersPath);
  const stringSections = readStringSections(sectionsPath);
  const stringsByVirtualAddress = readStrings(stringsPath, segments, stringSections);
  const binary = fs.readFileSync(binaryPath);
  const input = fs.createReadStream(disassemblyPath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let nextRow = 0;
  let activeRows = [];

  for await (const line of lines) {
    const instruction = line.match(/^\s*([0-9a-f]+):\s+/i);
    if (instruction === null) continue;
    const instructionAddress = Number.parseInt(instruction[1], 16);
    while (nextRow < rows.length && rows[nextRow].start <= instructionAddress) {
      activeRows.push(rows[nextRow]);
      nextRow += 1;
    }
    activeRows = activeRows.filter(({ end }) => instructionAddress < end);
    const owners = matchingRows(activeRows, instructionAddress);
    if (owners.length === 0) continue;

    const call = line.match(/\bblx?(?:\.[a-z]+)?\s+(?:0x)?([0-9a-f]+)\s+<(.*)>/i);
    const constants = [...line.matchAll(/#(-?(?:0x[0-9a-f]+|[0-9]+))/gi)]
      .map((match) => match[1].toLowerCase());
    const literal = line.match(/;\s*\((?:0x)?([0-9a-f]+)(?:\s+<[^>]*>)?\)/i);
    let stringXref = null;
    let literalLoad = null;
    if (literal !== null) {
      const literalAddress = Number.parseInt(literal[1], 16);
      const literalOffset = virtualToFileOffset(segments, literalAddress);
      if (literalOffset !== null && literalOffset >= 0 && literalOffset + 4 <= binary.length) {
        const targetAddress = binary.readUInt32LE(literalOffset);
        const register = line.match(/\bldr(?:\.w|\.n)?\s+(r(?:1[0-2]|[0-9])),\s*\[pc\b/i)?.[1]
          ?.toLowerCase();
        if (register !== undefined) {
          literalLoad = {
            register,
            loadSiteAddress: instructionAddress,
            literalAddress,
            value: targetAddress,
          };
        }
        const text = stringsByVirtualAddress.get(targetAddress);
        if (text !== undefined) {
          stringXref = {
            siteAddress: hex(instructionAddress),
            literalAddress: hex(literalAddress),
            targetAddress: hex(targetAddress),
            text,
          };
        }
      }
    }
    const pcAdd = line.match(
      /\badd(?:s|\.w|\.n)?\s+(r(?:1[0-2]|[0-9])),\s*(?:(r(?:1[0-2]|[0-9])),\s*)?pc\b/i,
    );

    for (const owner of owners) {
      if (call !== null) {
        owner.calls.set(hex(instructionAddress), {
          siteAddress: hex(instructionAddress),
          targetAddress: hex(Number.parseInt(call[1], 16)),
          targetSymbol: call[2],
        });
      }
      for (const constant of constants) owner.constants.add(constant);
      if (literalLoad !== null) {
        owner.registerLiterals.set(literalLoad.register, literalLoad);
      }
      if (stringXref !== null) {
        owner.stringXrefs.set(hex(instructionAddress), stringXref);
      }
      if (pcAdd !== null) {
        const sourceRegister = (pcAdd[2] ?? pcAdd[1]).toLowerCase();
        const tracked = owner.registerLiterals.get(sourceRegister);
        if (tracked !== undefined && instructionAddress - tracked.loadSiteAddress <= 16) {
          const pcBase = (instructionAddress + 4) & ~3;
          const targetAddress = (tracked.value + pcBase) >>> 0;
          const text = stringsByVirtualAddress.get(targetAddress);
          if (text !== undefined) {
            owner.stringXrefs.set(hex(instructionAddress), {
              siteAddress: hex(instructionAddress),
              loadSiteAddress: hex(tracked.loadSiteAddress),
              literalAddress: hex(tracked.literalAddress),
              targetAddress: hex(targetAddress),
              text,
            });
          }
        }
      }
    }
  }

  const outputRows = rows.map((row) => {
    const calls = [...row.calls.values()].sort(
      (left, right) => compareText(left.siteAddress, right.siteAddress),
    );
    const constants = [...row.constants].sort((left, right) => {
      const numeric = Number.parseInt(left, 0) - Number.parseInt(right, 0);
      return numeric || compareText(left, right);
    });
    const stringXrefs = [...row.stringXrefs.values()].sort(
      (left, right) => compareText(left.siteAddress, right.siteAddress),
    );
    return [
      ...row.fields,
      String(calls.length),
      JSON.stringify(calls),
      String(constants.length),
      JSON.stringify(constants),
      String(stringXrefs.length),
      JSON.stringify(stringXrefs),
      'auto-indexed',
    ].map(csv).join(',');
  });

  fs.writeFileSync(
    outputPath,
    `${[...EXPECTED_HEADER, ...ENRICHED_FIELDS].join(',')}\n${outputRows.join('\n')}\n`,
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify({
      schemaVersion: 1,
      scope: 'application-owned-native-functions',
      totalFunctions: rows.length,
      functionsWithDirectCalls: rows.filter(({ calls }) => calls.size > 0).length,
      functionsWithNumericConstants: rows.filter(({ constants }) => constants.size > 0).length,
      functionsWithStringXrefs: rows.filter(({ stringXrefs }) => stringXrefs.size > 0).length,
      reviewStates: {
        'auto-indexed': rows.length,
      },
      stringXrefPolicy: 'exact little-endian literal pointer to an indexed printable string',
    }, null, 2)}\n`,
  );
}

if (process.argv.length !== 10) {
  fail(
    'usage: enrich-native-function-map.mjs '
    + '<app-inventory.csv> <gnu-full.txt> <strings.txt> '
    + '<libgame.so> <gnu-program-headers.txt> <gnu-sections.txt> '
    + '<output.csv> <summary.json>',
  );
}

await enrich({
  inputPath: process.argv[2],
  disassemblyPath: process.argv[3],
  stringsPath: process.argv[4],
  binaryPath: process.argv[5],
  programHeadersPath: process.argv[6],
  sectionsPath: process.argv[7],
  outputPath: process.argv[8],
  summaryPath: process.argv[9],
});
