import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvVariantDto } from '../../../models';

@Component({
  selector: 'app-cv-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-table.component.html',
})
export class CvTableComponent {
  @Input() rows: CvVariantDto[] = [];

  @Output() edit = new EventEmitter<CvVariantDto>();
  @Output() delete = new EventEmitter<number>();
}
