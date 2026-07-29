import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decodifica entidades HTML (nomeadas e numéricas) e remove tags HTML.
 * Necessário para campos vindos da InterFast que chegam com e.g. &#47; em vez de /.
 *
 * Ordem das substituições:
 *  1. Remove tags HTML (<...>)
 *  2. Entidades numéricas hex (&#x2F; → /)
 *  3. Entidades numéricas decimais (&#47; → /)
 *  4. Entidades nomeadas comuns
 *  5. &amp; por último para não interferir com os passos anteriores
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}
