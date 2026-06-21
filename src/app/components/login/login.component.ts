import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="brand-header">
          <h1>ApplyFlow</h1>
          <p class="subtitle">Smart Application & Skill Tracker</p>
        </div>

        <div class="card-body">
          <p class="prompt-text">
            Sign in to sync your application templates, master variants, and
            skills directory.
          </p>

          <button (click)="onGoogleLogin()" class="google-signin-btn">
            <svg
              class="google-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div class="card-footer">
          <p>© 2026 ApplyFlow. Secure OAuth2 Authentication.</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .login-card {
        background: #ffffff;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 400px;
        text-align: center;
      }
      .brand-header h1 {
        margin: 0;
        font-size: 2.5rem;
        color: #2c3e50;
        font-weight: 700;
      }
      .subtitle {
        color: #7f8c8d;
        margin-top: 5px;
        font-size: 1rem;
      }
      .card-body {
        margin: 40px 0;
      }
      .prompt-text {
        color: #34495e;
        font-size: 0.95rem;
        line-height: 1.5;
        margin-bottom: 30px;
      }
      .google-signin-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        background-color: #ffffff;
        color: #757575;
        border: 1px solid #dadce0;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s, box-shadow 0.2s;
      }
      .google-signin-btn:hover {
        background-color: #f8f9fa;
        box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3),
          0 4px 8px 3px rgba(60, 64, 67, 0.15);
      }
      .google-icon {
        display: block;
      }
      .card-footer {
        font-size: 0.8rem;
        color: #bdc3c7;
      }
    `,
  ],
})
export class LoginComponent {
  private authService = inject(AuthService);

  onGoogleLogin(): void {
    this.authService.loginWithGoogle();
  }
}
