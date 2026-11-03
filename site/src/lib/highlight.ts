import { codeToHtml } from 'shiki';

/** Build-time syntax highlighting with the same dual themes as rendered Markdown. */
export function highlight(code: string, lang: 'json' | 'yaml' | 'sh'): Promise<string> {
  return codeToHtml(code, { lang, themes: { dark: 'github-dark', light: 'github-light' }, defaultColor: false });
}
