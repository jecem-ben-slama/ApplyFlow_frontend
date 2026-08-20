import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  AfterViewInit,
} from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-tile.component.html',
})
export class StatTileComponent implements AfterViewInit {
  @Input() label = '';

  @Input() value: string | number = '—';

  @Input() loading = false;

  @Input() emphasis: 'primary' | 'secondary' = 'primary';

  @Input() explanation = '';

  @ViewChild('infoButton')
  infoButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('tooltip')
  tooltip?: ElementRef<HTMLDivElement>;

  showTooltip = false;

  tooltipPosition: 'left' | 'right' = 'right';

  constructor(private elRef: ElementRef) {}

  ngAfterViewInit(): void {
    /*
     * Nothing needs to be calculated initially.
     * Positioning happens when the tooltip is opened.
     */
  }

  toggleTooltip(event: Event): void {
    event.stopPropagation();

    this.showTooltip = !this.showTooltip;

    if (this.showTooltip) {
      /*
       * Wait until Angular has rendered the tooltip.
       */
      setTimeout(() => {
        this.positionTooltip();
      });
    }
  }

  private positionTooltip(): void {
    if (!this.infoButton || !this.tooltip) {
      return;
    }

    const button = this.infoButton.nativeElement;
    const tooltip = this.tooltip.nativeElement;

    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    /*
     * Minimum distance we want between the tooltip
     * and the edge of the viewport.
     */
    const viewportPadding = 12;

    /*
     * Available space on each side of the button.
     */
    const spaceRight = window.innerWidth - buttonRect.right - viewportPadding;

    const spaceLeft = buttonRect.left - viewportPadding;

    /*
     * If there isn't enough room on the right,
     * but there is enough room on the left,
     * move the tooltip to the left.
     */
    if (spaceRight < tooltipRect.width && spaceLeft >= tooltipRect.width) {
      this.tooltipPosition = 'left';
    } else {
      /*
       * Default position.
       */
      this.tooltipPosition = 'right';
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.showTooltip) {
      return;
    }

    setTimeout(() => {
      this.positionTooltip();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.showTooltip = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showTooltip = false;
  }
}
