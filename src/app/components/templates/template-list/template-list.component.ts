import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TemplateFilterComponent } from '../template-filter/template-filter.component';
import { PaginationComponent } from '../../common/pagination/pagination.component';
import { TemplateComponent } from '../templates-view/templates.component';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    TemplateFilterComponent,
  ],
  templateUrl: './template-list.component.html',
})
export class TemplateListComponent {
  @Input() templates: TemplateComponent[] = [];
  @Input() totalElements = 0;
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() loading = false;
  @Input() selectedLanguage: string | undefined = undefined;
  @Input() searchTerm = '';
  @Input() editingId: number | null = null;

  @Output() filterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() edit = new EventEmitter<TemplateComponent>();
  @Output() delete = new EventEmitter<number | undefined>();
}
