import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {
  // Can be 'table', 'card', or 'list'
  @Input() type: 'table' | 'card' | 'list' = 'table';

  // Dynamic rows or repeats
  @Input() itemsCount: number = 5;

  // Helper to generate loop arrays in modern Angular templates
  get counterArray(): number[] {
    return Array(this.itemsCount).fill(0);
  }
}
