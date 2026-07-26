import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const locale = z.enum(["en", "vi"]);
const chapters = defineCollection({
  loader: glob({
    base: "./src/content/chapters",
    pattern: "**/*.{md,mdx}",
  }),
  schema: z.object({
    id: z.string().min(1),
    locale,
    order: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
    dek: z.string().min(1),
    summary: z.string().min(1),
    chapterKind: z.literal("forensics"),
    evidenceRefs: z.array(z.string().min(1)).min(1),
    mediaRefs: z.array(z.string().min(1)),
    nextId: z.string().min(1).nullable(),
    seoTitle: z.string().min(1),
    seoDescription: z.string().min(1),
    draft: z.boolean().default(false),
  }),
});

const claimPresentations = defineCollection({
  loader: file("src/generated/facts.json", {
    parser: (source) => {
      const generated = JSON.parse(source) as {
        claimPresentations?: Array<Record<string, unknown> & {
          canonicalClaimId?: string;
        }>;
      };
      return (generated.claimPresentations ?? []).map((record) => ({
        id: record.canonicalClaimId,
        ...record,
      }));
    },
  }),
  schema: z.object({
    id: z.string().min(1),
    canonicalClaimId: z.string().min(1),
    order: z.number().int().positive(),
    claim: z.string().min(1),
    status: z.enum(["recovered", "inferred", "unknown"]),
    evidenceTier: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().min(1)),
    contradictionIds: z.array(z.string().min(1)),
    contractEligible: z.boolean(),
    publicCopy: z.object({ en: z.string().min(1), vi: z.string().min(1) }),
    copy: z.object({ en: z.string().min(1), vi: z.string().min(1) }),
    publicExcerpt: z.object({
      en: z.string().min(1),
      vi: z.string().min(1),
    }),
    publicExplanation: z.object({
      en: z.string().min(1),
      vi: z.string().min(1),
    }),
    displayQualifier: z.object({
      en: z.string().min(1),
      vi: z.string().min(1),
    }),
    tags: z.array(z.string().min(1)),
    redaction: z.object({
      disposition: z.enum(["public", "redacted"]),
      reason: z.object({ en: z.string().min(1), vi: z.string().min(1) }),
    }),
    publicSourceIds: z.array(z.string().min(1)).min(1),
    citations: z.array(z.object({
      sourceId: z.string().min(1),
      href: z.string().min(1),
    })),
    fieldSources: z.record(z.string(), z.object({
      path: z.string().min(1),
      fieldPointer: z.string().min(1),
    })),
  }).strict(),
});

export const collections = {
  chapters,
  claimPresentations,
};
