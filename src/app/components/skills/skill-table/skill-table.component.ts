import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Skill } from '../../../models';
import { PaginationComponent } from '../../common/pagination/pagination.component';
import { SkeletonComponent } from "../../common/skeleton/skeleton.components";

@Component({
  selector: 'app-skill-table',
  standalone: true,
  imports: [CommonModule, MatIconModule, PaginationComponent, SkeletonComponent],
  templateUrl: './skill-table.component.html',
})
export class SkillTableComponent {
  @Input() skills: Skill[] = [];
  @Input() categoriesCount = 0;
  @Input() loading = false;
  @Input() totalPages = 0;
  @Input() currentPage = 0;
  @Input() selectedFilterCategoryId: number | null = null;

  @Output() pageChange = new EventEmitter<number>();
  @Output() editSkill = new EventEmitter<Skill>();
  @Output() deleteSkill = new EventEmitter<number>();
}
