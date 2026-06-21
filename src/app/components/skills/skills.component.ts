import { Component, OnInit } from '@angular/core';
import { SkillsService } from '../../services/skills.service';
import { Skill } from '../../models';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: 'app-skills',
  templateUrl: './skills.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
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

  isFormVisible = true;
  editingSkillId: number | null = null;

  currentPage = 0;
  pageSize = 15;
  totalPages = 0;
  totalElements = 0;

  newSkill = {
    displayName: '',
    technicalName: '',
    sentenceEn: '',
    sentenceFr: '',
  };

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
          this.skills = page.content;
          this.totalPages = page.totalPages;
          this.totalElements = page.totalElements;
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
      displayName: skill.displayName,
      technicalName: skill.technicalName,
      sentenceEn: skill.sentenceEn || '',
      sentenceFr: skill.sentenceFr || '',
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCancelEdit(): void {
    this.editingSkillId = null;
    this.newSkill = {
      displayName: '',
      technicalName: '',
      sentenceEn: '',
      sentenceFr: '',
    };
  }

  onCreateSkill(): void {
    if (!this.newSkill.displayName || !this.newSkill.technicalName) {
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
            displayName: '',
            technicalName: '',
            sentenceEn: '',
            sentenceFr: '',
          };
          this.loadSkills();
        },
        error: (err) => {
          console.error('Failed to append custom reference key:', err);
          this.loading = false;
        },
      });
    }
  }

  onDeleteSkill(id: number): void {
    if (!confirm('Are you sure you want to drop this skill parsing block?'))
      return;
    if (this.editingSkillId === id) this.onCancelEdit();
    this.skillsService.deleteSkill(id).subscribe({
      next: () => this.loadSkills(),
      error: (err) =>
        console.error(
          'Failed to completely drop skill key configuration:',
          err
        ),
    });
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadSkills();
  }
}
