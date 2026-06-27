import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-template-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './template-filter.component.html',
})
export class TemplateFilterComponent {
  @Input() selectedLanguage: string | undefined = undefined;
  @Input() totalElements = 0;
  @Input() currentCount = 0;
  @Input() searchTerm = '';

  localSearchTerm = '';

  @Output() filterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();

  onFilterChange(lang: string) {
    this.filterChange.emit(lang);
  }

  onSearchInput() {
    this.searchChange.emit(this.localSearchTerm);
  }
}
