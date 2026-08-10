import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CvVariantDto } from '../../../models';

export type CvSortableColumn = 'name' | 'language';

@Component({
  selector: 'app-cv-table',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './cv-table.component.html',
})
export class CvTableComponent {
  @Input() rows: CvVariantDto[] = [];
  @Input() loading = false;
  @Input() sortBy = '';
  @Input() direction: 'asc' | 'desc' = 'asc';

  @Output() edit = new EventEmitter<CvVariantDto>();
  @Output() delete = new EventEmitter<CvVariantDto>();
  @Output() sortChange = new EventEmitter<CvSortableColumn>();

  onSortClick(column: CvSortableColumn): void {
    this.sortChange.emit(column);
  }
}
