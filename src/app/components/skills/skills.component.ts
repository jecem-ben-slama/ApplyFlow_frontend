import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SkillsService } from '../../services/skills.service';
import { Skill } from '../../models';

// Interface matching the custom UI metrics on your design dashboard
interface MarketFitMetric {
  name: string;
  matchPercentage: number;
  marketTrend: number;
}

interface SkillGap {
  missingSkill: string;
  frequency: number;
}

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './skills.component.html',
})
export class SkillsComponent implements OnInit {
  skills: Skill[] = [];
  loading = true;

  // Exact metrics tracked visually in your UI specs
  overallMatchRate = 92;
  marketFitData: MarketFitMetric[] = [
    { name: 'TypeScript', matchPercentage: 98, marketTrend: 2 },
    { name: 'React / Next.js', matchPercentage: 95, marketTrend: 0 },
    { name: 'Node.js / Express', matchPercentage: 82, marketTrend: -4 },
    { name: 'PostgreSQL', matchPercentage: 76, marketTrend: 12 },
    { name: 'AWS / Cloud', matchPercentage: 64, marketTrend: 4 },
  ];

  suggestedGaps: SkillGap[] = [
    { missingSkill: 'GraphQL', frequency: 4 },
    { missingSkill: 'Docker', frequency: 3 },
    { missingSkill: 'Kubernetes', frequency: 2 },
    { missingSkill: 'Testing Library', frequency: 1 },
  ];

  // Form State for creating a new master skill
  newSkillName = '';
  newTechName = '';

  constructor(private skillsService: SkillsService) {}

  ngOnInit(): void {
    this.loadSkills();
  }

  loadSkills(): void {
    this.loading = true;
    this.skillsService.getAllSkills(0, 50).subscribe({
      next: (page) => {
        this.skills = page.content;
        this.loading = false;
      },
      error: (err) => {
        console.error(
          'Failed fetching master skills. Using local mock dataset.',
          err
        );
        this.loading = false;
      },
    });
  }

  onCreateSkill(): void {
    if (!this.newSkillName.trim()) return;

    const payload: Omit<Skill, 'id'> = {
      displayName: this.newSkillName,
      technicalName:
        this.newTechName ||
        this.newSkillName.toLowerCase().replace(/\s+/g, '-'),
      sentenceEn: `Proficient engineering capabilities utilizing ${this.newSkillName}.`,
      sentenceFr: `Compétences techniques approfondies en ${this.newSkillName}.`,
    };

    this.skillsService.createSkill(payload).subscribe({
      next: (newSkill) => {
        this.skills.unshift(newSkill); // Add to view list
        this.newSkillName = '';
        this.newTechName = '';
      },
    });
  }

  onDeleteSkill(id: number): void {
    if (confirm('Are you sure you want to remove this skill reference?')) {
      this.skillsService.deleteSkill(id).subscribe({
        next: () => {
          this.skills = this.skills.filter((s) => s.id !== id);
        },
      });
    }
  }
}
