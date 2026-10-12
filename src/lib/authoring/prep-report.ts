/**
 * Words and numbers for the photos:prep report. PURE: outcomes in, text out.
 * Colours are added by the CLI.
 */
import { HEIC_CONVERSION_HELP } from '../content/validate.ts';
import { countLabel as count } from '../presentation.ts';
import type { PrepOutcome } from './prep-files.ts';
import type { ImageSnapshot } from './prep.ts';
import { PREP_LIMITS } from './prep-rules.ts';

/** "812 KB", "5.1 MB" (binary units, as photos:check and file browsers show them). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dims = (size: ImageSnapshot) => `${size.width}×${size.height}`;

export type LineTone = 'changed' | 'ok' | 'attention' | 'error';

export interface ReportLine {
  /** Short status word, e.g. "resized". */
  label: string;
  tone: LineTone;
  /** Details after the file name. */
  detail: string;
}

const ACTION_LABEL = { resize: 'resized', recompress: 'compressed', strip: 'cleaned', none: 'ok' } as const;
const DRY_RUN_LABEL = { resize: 'would resize', recompress: 'would compress', strip: 'would clean', none: 'ok' } as const;

/** One line per file. */
export function describeOutcome(outcome: PrepOutcome, dryRun: boolean): ReportLine {
  switch (outcome.kind) {
    case 'jpeg': {
      const { result } = outcome;
      const { before, after } = result;
      const label = (dryRun ? DRY_RUN_LABEL : ACTION_LABEL)[result.action];
      if (result.action === 'none') {
        const note = result.note ? ` (${result.note})` : '';
        return { label, tone: 'ok', detail: `${dims(before)}, ${formatBytes(before.bytes)}: already web-ready${note}` };
      }
      const size = before.width === after.width && before.height === after.height ? dims(before) : `${dims(before)} → ${dims(after)}`;
      const parts = [`${size}, ${formatBytes(before.bytes)} → ${formatBytes(after.bytes)}`];
      if (result.rotated) parts.push('turned upright');
      if (result.removed.length > 0) parts.push(`removed ${result.removed.join(', ')}`);
      if (result.note) parts.push(result.note);
      return { label, tone: 'changed', detail: parts.join('; ') };
    }
    case 'heic':
      return {
        label: 'convert',
        tone: 'attention',
        detail: outcome.disguised
          ? 'this is really a HEIC/HEIF photo with a JPEG name. Convert it to JPEG (see below), then run photos:prep again.'
          : 'HEIC/HEIF photo: convert it to JPEG (see below), then run photos:prep again.',
      };
    case 'unsupported':
      return { label: 'skipped', tone: 'attention', detail: 'this image format cannot be used on the website. Convert it to JPEG.' };
    case 'other-format': {
      const { snapshot, format } = outcome;
      const name = format.toUpperCase();
      const notes: string[] = [];
      if (outcome.oversize) {
        notes.push(
          `too big (limit ${PREP_LIMITS.maxLongEdge} px on the long side). photos:prep only changes JPEG files: ` +
            `export it again smaller, or as a JPEG if it is a photo`,
        );
      }
      if (outcome.hasGps) notes.push('contains a GPS location: export it again without location data (or as a JPEG and run photos:prep)');
      return {
        label: notes.length > 0 ? 'check' : 'ok',
        tone: notes.length > 0 ? 'attention' : 'ok',
        detail: `${name}, ${dims(snapshot)}, ${formatBytes(snapshot.bytes)}: left as is${notes.length > 0 ? `; ${notes.join('; ')}` : ''}.`,
      };
    }
    case 'demo':
      return { label: 'skipped', tone: 'ok', detail: 'generated demo image: left as is (npm run demo:images owns it).' };
    case 'error':
      return { label: 'error', tone: 'error', detail: outcome.message };
  }
}

export interface PrepSummary {
  jpegs: number;
  resized: number;
  recompressed: number;
  cleaned: number;
  unchanged: number;
  bytesBefore: number;
  bytesAfter: number;
  gpsRemoved: number;
  heic: number;
  unsupported: number;
  otherFormatsToCheck: number;
  /** Generated demo images, left alone. */
  demo: number;
  errors: number;
}

export function summarise(outcomes: readonly PrepOutcome[]): PrepSummary {
  const summary: PrepSummary = {
    jpegs: 0, resized: 0, recompressed: 0, cleaned: 0, unchanged: 0, bytesBefore: 0, bytesAfter: 0,
    gpsRemoved: 0, heic: 0, unsupported: 0, otherFormatsToCheck: 0, demo: 0, errors: 0,
  };
  for (const outcome of outcomes) {
    if (outcome.kind === 'heic') summary.heic++;
    else if (outcome.kind === 'unsupported') summary.unsupported++;
    else if (outcome.kind === 'error') summary.errors++;
    else if (outcome.kind === 'demo') summary.demo++;
    else if (outcome.kind === 'other-format') summary.otherFormatsToCheck += outcome.oversize || outcome.hasGps ? 1 : 0;
    else {
      const { result } = outcome;
      summary.jpegs++;
      summary.bytesBefore += result.before.bytes;
      summary.bytesAfter += result.after.bytes;
      if (result.action === 'resize') summary.resized++;
      else if (result.action === 'recompress') summary.recompressed++;
      else if (result.action === 'strip') summary.cleaned++;
      else summary.unchanged++;
      if (result.removed.includes('GPS location')) summary.gpsRemoved++;
    }
  }
  return summary;
}

export interface SummaryLine {
  text: string;
  /** `attention`: something the maintainer still has to do. */
  tone: 'info' | 'attention';
}

/** Summary lines: totals first, then anything that still needs the maintainer. */
export function summaryLines(summary: PrepSummary, dryRun: boolean): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const info = (text: string) => lines.push({ text, tone: 'info' });
  const attention = (text: string) => lines.push({ text, tone: 'attention' });
  if (summary.jpegs === 0) {
    if (summary.demo === 0) info('No JPEG photos found.');
  } else {
    const parts = [
      summary.resized > 0 ? `${summary.resized} ${dryRun ? 'to resize' : 'resized'}` : '',
      summary.recompressed > 0 ? `${summary.recompressed} ${dryRun ? 'to compress' : 'compressed'}` : '',
      summary.cleaned > 0 ? `${summary.cleaned} ${dryRun ? 'to clean' : 'cleaned'} (metadata only)` : '',
      summary.unchanged > 0 ? `${summary.unchanged} already web-ready` : '',
    ].filter(Boolean);
    const saved = summary.bytesBefore - summary.bytesAfter;
    const sizes =
      saved > 0
        ? ` ${formatBytes(summary.bytesBefore)} → ${formatBytes(summary.bytesAfter)} (${dryRun ? 'would save' : 'saved'} ${formatBytes(saved)}).`
        : '';
    info(`${count(summary.jpegs, 'JPEG photo')}: ${parts.join(', ')}.${sizes}`);
  }
  if (summary.gpsRemoved > 0) {
    info(`GPS location ${dryRun ? 'would be removed' : 'removed'} from ${count(summary.gpsRemoved, 'photo')}.`);
  }
  if (summary.demo > 0) info(`${count(summary.demo, 'generated demo image')} left as is (photos:prep never changes the demo folders).`);
  if (summary.heic > 0) attention(`${count(summary.heic, 'HEIC photo')} must be converted to JPEG. ${HEIC_CONVERSION_HELP}`);
  if (summary.unsupported > 0) attention(`${count(summary.unsupported, 'file')} in a format the website cannot use: convert to JPEG.`);
  if (summary.otherFormatsToCheck > 0) attention(`${count(summary.otherFormatsToCheck, 'PNG/WebP file')} to check by hand (see above).`);
  if (summary.errors > 0) attention(`${count(summary.errors, 'file')} could not be processed (see above).`);
  return lines;
}

/** True when something is left that photos:check would reject (exit code 1). */
export const needsAttention = (summary: PrepSummary): boolean => summary.errors + summary.heic + summary.unsupported > 0;
