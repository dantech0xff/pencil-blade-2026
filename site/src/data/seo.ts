import type { Locale } from "./locales.ts";

export const SITE_NAME = "Pencil Blade · Evidence to Reconstruction";
export const SITE_ORIGIN = "https://dantech0xff.github.io";

export interface SeoRecord {
  title: string;
  description: string;
  socialImage: string;
}

export function getDefaultSeo(locale: Locale): SeoRecord {
  return locale === "vi"
    ? {
        title: "Pencil Blade · Từ bằng chứng đến bản phục dựng",
        description: "Hồ sơ kỹ thuật song ngữ về phục dựng clean-room Pencil Blade từ một APK không thể chạy.",
        socialImage: "/social/pencil-blade-vi.png",
      }
    : {
        title: SITE_NAME,
        description: "A bilingual engineering case file about reconstructing Pencil Blade from one non-runnable APK.",
        socialImage: "/social/pencil-blade-en.png",
      };
}
