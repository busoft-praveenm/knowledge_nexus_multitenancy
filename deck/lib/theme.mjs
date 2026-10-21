// Theme + small rendering helpers shared by build-deck.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);

/**
 * "BuSoft" — built from the BuSoft Tech logo (orange #F49217, yellow #F5E051, red #EA191E).
 * Orange is the primary brand colour; yellow is the highlight; red is reserved for "danger/breach".
 * Light content slides, brand-orange bookends with dark text (white on #F49217 is too low-contrast).
 * Slot usage: dk1 = main text, lt1 = slide background (white),
 * dk2 = BuSoft orange (title/section/closing backgrounds), lt2 = card surface.
 *   accent1 orange (a shade deeper than the logo, for shapes/numbers on white)
 *   accent2 red     — breach / danger
 *   accent3 teal    — info / Globex
 *   accent4 green   — "defended"
 *   accent5 coral   — Acme
 *   accent6 violet  — tenant_id / Initech
 * Fonts are Office cloud fonts, so they render in PowerPoint for the web:
 * Cambria (headings), Arial (body), Consolas (code).
 */
export const THEME = {
  name: 'BuSoft',
  headFontFace: 'Cambria',
  bodyFontFace: 'Arial',
  colors: {
    dk1: '2B2424',
    lt1: 'FFFFFF',
    dk2: 'F49217',
    lt2: 'F7F5F2',
    accent1: 'E07B0A',
    accent2: 'DC2626',
    accent3: '0891B2',
    accent4: '15803D',
    accent5: 'E8604C',
    accent6: '7C3AED',
    hlink: 'B45309',
    folHlink: '7C3AED',
  },
};

/** pptxgenjs writes Office's stock palette; replace it with ours after writeFile(). */
export async function applyTheme(file, theme) {
  const JSZip = require(require.resolve('jszip', { paths: [require.resolve('pptxgenjs')] }));
  const zip = await JSZip.loadAsync(await readFile(file));
  const themeFiles = Object.keys(zip.files).filter((f) => /^ppt\/theme\/theme\d+\.xml$/.test(f));
  const slots = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const scheme =
    `<a:clrScheme name="${theme.name}">` +
    slots.map((s) => `<a:${s}><a:srgbClr val="${theme.colors[s]}"/></a:${s}>`).join('') +
    `</a:clrScheme>`;
  for (const f of themeFiles) {
    let xml = await zip.file(f).async('string');
    xml = xml.replace(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/, scheme).replace(/(<a:theme[^>]*\sname=")[^"]*(")/, `$1${theme.name}$2`);
    zip.file(f, xml);
  }
  await writeFile(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

/** Render a react-icons component to a base64 PNG data string for addImage(). */
export async function iconPng(Icon, hex = '0B1020', size = 256) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const sharp = require('sharp');
  const svg = renderToStaticMarkup(React.createElement(Icon, { size, color: `#${hex}` }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${buf.toString('base64')}`;
}
