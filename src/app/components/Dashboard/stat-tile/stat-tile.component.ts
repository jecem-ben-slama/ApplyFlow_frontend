import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-tile.component.html',
})
export class StatTileComponent {
  @Input() label = '';
  @Input() value: string | number = '—';
  @Input() loading = false;
  @Input() emphasis: 'primary' | 'secondary' = 'primary';
  @Input() deltaText = '';
  @Input() deltaPositive = true;
}
