import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  assertRestrictedMdxTree,
  restrictedMdxPolicy,
} from '../site/src/lib/restricted-mdx-policy.ts';
import {
  alternateLocalePath,
  localizedPath,
  mergeRouteFragments,
  withBase,
} from '../site/src/data/routes.ts';

function root(...children) {
  return { type: 'root', children };
}

function jsx(name, attributes = []) {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes,
    children: [],
  };
}

test('Pages helpers apply one base and preserve locale-aware directory routes', () => {
  assert.equal(withBase('/'), '/pencil-blade-2026/');
  assert.equal(withBase('/forensics/'), '/pencil-blade-2026/forensics/');
  assert.equal(
    withBase('/pencil-blade-2026/forensics/?claim=CLM-APK-BYTES#proof'),
    '/pencil-blade-2026/forensics/?claim=CLM-APK-BYTES#proof',
  );
  assert.equal(localizedPath('en', '/vi/forensics/'), '/forensics/');
  assert.equal(localizedPath('vi', '/forensics/'), '/vi/forensics/');
  assert.equal(alternateLocalePath('vi', '/forensics/#proof'), '/vi/forensics/#proof');
  assert.throws(() => withBase('https://example.com/forensics/'), /site-local path/u);
  assert.throws(() => withBase('/../forensics/'), /traversal/u);
});

test('route fragment merge rejects duplicate IDs, paths, and missing locale pairs', () => {
  const valid = [
    { id: 'forensics.en', localePairId: 'forensics', locale: 'en', path: '/forensics/' },
    { id: 'forensics.vi', localePairId: 'forensics', locale: 'vi', path: '/vi/forensics/' },
  ];
  assert.equal(mergeRouteFragments([valid]).length, 2);

  assert.throws(
    () => mergeRouteFragments([[valid[0], { ...valid[1], id: 'forensics.en' }]]),
    /Duplicate route ID/u,
  );
  assert.throws(
    () =>
      mergeRouteFragments([
        [
          valid[0],
          {
            id: 'other.en',
            localePairId: 'other',
            locale: 'en',
            path: '/forensics/',
          },
        ],
      ], { requireLocalePairs: false }),
    /Duplicate route path/u,
  );
  assert.throws(
    () => mergeRouteFragments([[valid[0]]]),
    /missing locale/u,
  );
  assert.throws(
    () => mergeRouteFragments([valid], { requiredRouteIds: ['play.en'] }),
    /Missing required route/u,
  );
});

test('restricted MDX permits semantic Markdown and allowlisted literal components', () => {
  const tree = root(
    {
      type: 'paragraph',
      children: [{ type: 'text', value: 'Evidence before claims.' }],
    },
    jsx('EvidenceRef', [
      { type: 'mdxJsxAttribute', name: 'claimId', value: 'CLM-APK-BYTES' },
    ]),
  );
  assert.doesNotThrow(() => assertRestrictedMdxTree(tree));
  assert.doesNotThrow(() => restrictedMdxPolicy()(tree));
});

for (const [name, tree, expected] of [
  [
    'ESM import/export',
    root({ type: 'mdxjsEsm', value: 'import value from "module"' }),
    /mdxjsEsm/u,
  ],
  [
    'flow expression',
    root({ type: 'mdxFlowExpression', value: 'dangerous()' }),
    /mdxFlowExpression/u,
  ],
  [
    'text expression',
    root({ type: 'mdxTextExpression', value: 'secret' }),
    /mdxTextExpression/u,
  ],
  [
    'raw HTML',
    root({ type: 'html', value: '<script>alert(1)</script>' }),
    /html/u,
  ],
  [
    'unknown component',
    root(jsx('RemoteWidget')),
    /not allowlisted/u,
  ],
  [
    'fragment',
    root({ type: 'mdxJsxFlowElement', name: null, attributes: [], children: [] }),
    /fragment/u,
  ],
  [
    'spread attribute',
    root(
      jsx('EvidenceRef', [
        { type: 'mdxJsxExpressionAttribute', value: '...props' },
      ]),
    ),
    /spread and expression/u,
  ],
  [
    'expression attribute',
    root(
      jsx('EvidenceRef', [
        {
          type: 'mdxJsxAttribute',
          name: 'claimId',
          value: { type: 'mdxJsxAttributeValueExpression', value: 'claimId' },
        },
      ]),
    ),
    /may not contain an expression/u,
  ],
  [
    'event handler',
    root(
      jsx('EvidenceRef', [
        { type: 'mdxJsxAttribute', name: 'onClick', value: 'run()' },
      ]),
    ),
    /onClick/u,
  ],
  [
    'Astro raw directive',
    root(
      jsx('EvidenceRef', [
        { type: 'mdxJsxAttribute', name: 'set:html', value: '<b>unsafe</b>' },
      ]),
    ),
    /set:html/u,
  ],
  [
    'dangerous URL',
    root(
      jsx('EvidenceRef', [
        { type: 'mdxJsxAttribute', name: 'href', value: 'javascript:alert(1)' },
      ]),
    ),
    /dangerous URL scheme/u,
  ],
  [
    'external resource request',
    root(
      jsx('EvidenceRef', [
        {
          type: 'mdxJsxAttribute',
          name: 'src',
          value: 'https://tracker.example/image.png',
        },
      ]),
    ),
    /external URL/u,
  ],
]) {
  test(`restricted MDX rejects ${name}`, () => {
    assert.throws(() => assertRestrictedMdxTree(tree), expected);
  });
}

test('content configuration keeps authored copy separate and loads canonical joins from generated facts', () => {
  const source = readFileSync(
    new URL('../site/src/content.config.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const chapters = defineCollection/u);
  assert.doesNotMatch(source, /const aiEpisodes = defineCollection/u);
  assert.match(source, /const claimPresentations = defineCollection/u);
  assert.match(source, /src\/generated\/facts\.json/u);
  const generatedCollectionSource = source.slice(
    source.indexOf('const claimPresentations = defineCollection'),
  );
  for (const field of [
    'status',
    'evidenceTier',
    'confidence',
    'evidenceRefs',
    'contradictionIds',
    'contractEligible',
  ]) {
    assert.match(generatedCollectionSource, new RegExp(`^\\s*${field}:`, 'mu'));
  }
});
