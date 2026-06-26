import { Component, Input, Output, EventEmitter } from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../models';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './category-list.component.html',
  animations: [
    trigger('sectionSlide', [
      transition(':enter', [
        style({ opacity: 0, height: '0px', overflow: 'hidden' }),
        animate(
          '280ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 1, height: '*' })
        ),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate(
          '220ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 0, height: '0px' })
        ),
      ]),
    ]),
  ],
})
export class CategoryListComponent {
  @Input() categories: Category[] = [];
  @Input() selectedFilterCategoryId: number | null = null;

  @Output() filterChange = new EventEmitter<number | null>();
  @Output() addCategory = new EventEmitter<void>();
  @Output() editCategory = new EventEmitter<Category>();
  @Output() deleteCategory = new EventEmitter<{
    category: Category;
    event: MouseEvent;
  }>();

  isCollapsed = true;

  onSelectCategory(id: number | null): void {
    this.filterChange.emit(id);
  }

  onEdit(category: Category, event: MouseEvent): void {
    event.stopPropagation();
    this.editCategory.emit(category);
  }

  onDelete(category: Category, event: MouseEvent): void {
    event.stopPropagation();
    this.deleteCategory.emit({ category, event });
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }
}