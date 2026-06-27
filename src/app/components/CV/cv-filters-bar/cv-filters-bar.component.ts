import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-cv-filters-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './cv-filters-bar.component.html',
})
export class CvFiltersBarComponent {
  @Input() selectedLanguage = '';
  @Input() searchQuery = '';

  @Output() languageChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() addClick = new EventEmitter<void>();
}
