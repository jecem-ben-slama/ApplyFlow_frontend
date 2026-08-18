import { Pipe, PipeTransform } from '@angular/core';

export interface TemplateSegment {
  text: string;
  isPlaceholder: boolean;
}

/**
 * Splits a template string like "Hi {{firstName}}, welcome to {{companyName}}"
 * into alternating plain-text and placeholder segments, so the UI can render
 * placeholders as pills instead of raw curly braces.
 */
@Pipe({
  name: 'templateSegments',
  standalone: true,
  pure: true,
})
export class TemplateSegmentsPipe implements PipeTransform {
  private static readonly PLACEHOLDER_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;

  transform(value: string | null | undefined): TemplateSegment[] {
    if (!value) return [];

    const segments: TemplateSegment[] = [];
    const regex = new RegExp(TemplateSegmentsPipe.PLACEHOLDER_REGEX);
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          text: value.slice(lastIndex, match.index),
          isPlaceholder: false,
        });
      }
      segments.push({ text: match[1].trim(), isPlaceholder: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < value.length) {
      segments.push({ text: value.slice(lastIndex), isPlaceholder: false });
    }

    return segments;
  }
}
