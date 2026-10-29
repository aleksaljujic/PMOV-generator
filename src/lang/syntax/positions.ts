import type { SourceSpan } from '../diagnostics';

/** Maps UTF-16 offsets to 1-based line/col. Only "\n" ends a line ("\r\n" is one newline). */
export class PositionMap {
  private readonly starts: number[] = [0];

  constructor(source: string) {
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === 10) this.starts.push(i + 1);
    }
  }

  lineOf(offset: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.starts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  span(from: number, to: number): SourceSpan {
    const line = this.lineOf(from);
    const endLine = this.lineOf(to);
    return {
      from,
      to,
      line,
      col: from - (this.starts[line - 1] as number) + 1,
      endLine,
      endCol: to - (this.starts[endLine - 1] as number) + 1,
    };
  }
}
