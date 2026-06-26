import { Component, OnInit } from '@angular/core';
import { SkillsService } from '../../services/skills.service';
import { Skill, getPageMeta } from '../../models';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../pagination/pagination.component';
import { DeletePopupComponent } from '../common/delete-popup/delete-popup.component';
import { trigger, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-skills',
  templateUrl: './skills.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PaginationComponent,
    DeletePopupComponent,
  ],
  animations: [
    trigger('formSlide', [
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
export class SkillsComponent implements OnInit {
  skills: Skill[] = [];
  loading = false;

  isFormVisible = false;
  editingSkillId: number | null = null;

  currentPage = 0;
  pageSize = 8;
  totalPages = 0;
  totalElements = 0;

  newSkill = {
    name: '',
    sentenceEn: '',
    sentenceFr: '',
  };

  // delete modal state
  showDeleteModal = false;
  deleteTargetId?: number;
  deleteMessage = 'Are you sure you want to drop this skill parsing block?';

  constructor(private skillsService: SkillsService) {}

  ngOnInit(): void {
    this.loadSkills();
  }

  loadSkills(): void {
    this.loading = true;
    this.skillsService
      .getAllSkills(this.currentPage, this.pageSize, 'id', 'asc')
      .subscribe({
        next: (page) => {
          const meta = getPageMeta(page);
          this.skills = page.content;
          this.totalPages = meta.totalPages;
          this.totalElements = meta.totalElements;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching workspace skills profile:', err);
          this.loading = false;
        },
      });
  }

  onToggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
  }

  onEditClick(skill: Skill): void {
    this.editingSkillId = skill.id;
    this.isFormVisible = true;
    this.newSkill = {
      name: skill.name || '',
      sentenceEn: skill.sentenceEn || '',
      sentenceFr: skill.sentenceFr || '',
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelEdit(): void {
    this.editingSkillId = null;
    this.newSkill = {
      name: '',
      sentenceEn: '',
      sentenceFr: '',
    };
  }

  onCreateSkill(): void {
    if (!this.newSkill.name.trim() || !this.newSkill.sentenceEn.trim()) {
      alert(
        'Please fill out at least the display and technical reference properties.'
      );
      return;
    }

    this.loading = true;

    if (this.editingSkillId !== null) {
      this.skillsService
        .updateSkill(this.editingSkillId, this.newSkill)
        .subscribe({
          next: () => {
            this.onCancelEdit();
            this.loadSkills();
          },
          error: (err) => {
            console.error(
              'Failed to patch targeted workspace reference block:',
              err
            );
            this.loading = false;
          },
        });
    } else {
      this.skillsService.createSkill(this.newSkill).subscribe({
        next: () => {
          this.newSkill = {
            name: '',
            sentenceEn: '',
            sentenceFr: '',
          };
          // Peek at page 0 to get updated totalPages, then jump to last page
          this.skillsService
            .getAllSkills(0, this.pageSize, 'id', 'asc')
            .subscribe((peek) => {
              const meta = getPageMeta(peek);
              this.currentPage = Math.max(0, meta.totalPages - 1);
              this.loadSkills();
            });
        },
        error: (err) => {
          console.error('Failed to append custom reference key:', err);
          this.loading = false;
        },
      });
    }
  }

  onDeleteSkill(id: number): void {
    this.deleteTargetId = id;
    this.showDeleteModal = true;
  }

  onConfirmDelete(): void {
    const id = this.deleteTargetId;
    if (!id) return;
    this.showDeleteModal = false;
    if (this.editingSkillId === id) this.onCancelEdit();
    this.skillsService.deleteSkill(id).subscribe({
      next: () => {
        const remainingOnPage = this.skills.length - 1;
        if (remainingOnPage === 0 && this.currentPage > 0) {
          this.currentPage--;
        }
        this.loadSkills();
      },
      error: (err) =>
        console.error(
          'Failed to completely drop skill key configuration:',
          err
        ),
    });
  }

  onCancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = undefined;
  }
  onPageChange(newPage: number): void {
    if (newPage < 0 || newPage >= this.totalPages) return;
    this.currentPage = newPage;
    this.loadSkills();
  }
}
