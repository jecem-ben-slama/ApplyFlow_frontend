import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Skill } from '../../../models';
import { PaginationComponent } from '../../common/pagination/pagination.component';

@Component({
  selector: 'app-skill-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PaginationComponent],
  templateUrl: './skill-table.component.html',
})
export class SkillTableComponent {
  @Input() skills: Skill[] = [];
  @Input() categoriesCount = 0;
  @Input() loading = false;
  @Input() totalPages = 0;
  @Input() currentPage = 0;
  @Input() searchTerm = '';
  @Input() selectedFilterCategoryId: number | null = null;

  @Output() searchChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() editSkill = new EventEmitter<Skill>();
  @Output() deleteSkill = new EventEmitter<number>();

  onSearchInput(): void {
    this.searchChange.emit(this.searchTerm);
  }
}
