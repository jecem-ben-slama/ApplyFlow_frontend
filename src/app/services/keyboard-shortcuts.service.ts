import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

export type KeyboardShortcut =
  | 'help'
  | 'focus-search'
  | 'new'
  | 'dashboard'
  | 'applications'
  | 'attatchements'
  | 'skills'
  | 'templates'
  | 'profile';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shortcutSubject = new Subject<KeyboardShortcut>();
  private paused = false;

  readonly shortcuts$ = this.shortcutSubject.asObservable();

  constructor() {
    this.document.addEventListener('keydown', this.onKeydown);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('keydown', this.onKeydown);
      this.shortcutSubject.complete();
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  openHelp(): void {
    this.emit('help');
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (
      this.paused ||
      event.defaultPrevented ||
      this.isTypingTarget(event.target)
    )
      return;

    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;

    if (modifier && key === 'k') {
      event.preventDefault();
      this.emit('help');
      return;
    }

    const shortcuts: Record<string, KeyboardShortcut> = {
      '?': 'help',
      '/': 'focus-search',
      n: 'new',
      d: 'dashboard',
      a: 'applications',
      c: 'attatchements',
      s: 'skills',
      t: 'templates',
      p: 'profile',
    };

    const shortcut = shortcuts[key];
    if (!shortcut || modifier || event.altKey) return;

    event.preventDefault();
    this.emit(shortcut);
  };

  private emit(shortcut: KeyboardShortcut): void {
    this.shortcutSubject.next(shortcut);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;

    return (
      element.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
    );
  }
}
