import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';

interface FeatureSlide {
  title: string;
  tagline: string;
  description: string;
  badge: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule,RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);

  activeModal: 'privacy' | 'terms' | null = null;
  currentSlide = 0;
  private slideInterval: any;

  slides: FeatureSlide[] = [
    {
      badge: 'Smart Organization',
      title: 'Master Application Tracking',
      tagline: 'Keep every submission in sync across all target roles.',
      description:
        'Organize your job hunt, set follow-up reminders, and track stages from applied to interview in real time.',
    },
    {
      badge: 'Tailored Resumes',
      title: 'Dynamic CVs and emails for Each Role',
      tagline: 'Match your profile precisely to requirements.',
      description:
        'Manage master skill repositories and dynamically assemble specialized resumes tailored to specific job specs.',
    },
    {
      badge: 'Centralized Assets',
      title: 'Unified Application Templates',
      tagline: 'Never start cover letters or essays from scratch.',
      description:
        'Store modular cover letters, portfolio links, and responses to common application questions for fast execution.',
    },
    {badge:' Stats and Feedback',
    title: 'Data-Driven Job Hunt Insights',
    tagline: 'Track your progress and optimize your strategy.',
    description:
      'Analyze application success rates, interview feedback, and industry trends to refine your approach and increase your chances of landing the right role.',

    },
  ];

  ngOnInit(): void {
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  startAutoSlide(): void {
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  stopAutoSlide(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  setSlide(index: number): void {
    this.currentSlide = index;
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  onGoogleLogin(): void {
    this.authService.loginWithGoogle();
  }

  openModal(type: 'privacy' | 'terms'): void {
    this.activeModal = type;
  }

  closeModal(): void {
    this.activeModal = null;
  }
}
