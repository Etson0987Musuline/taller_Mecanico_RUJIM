import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>('light');

  constructor() {
    let initial: Theme = 'light';
    try {
      if (this.document.defaultView?.localStorage.getItem('rujim-theme') === 'dark') initial = 'dark';
    } catch { /* La apariencia también funciona si el navegador bloquea el almacenamiento. */ }
    this.apply(initial);
  }

  setTheme(theme: Theme): void {
    this.apply(theme);
    try { this.document.defaultView?.localStorage.setItem('rujim-theme', theme); } catch { /* Preferencia de esta sesión. */ }
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    this.document.documentElement.setAttribute('data-bs-theme', theme);
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document.documentElement.style.colorScheme = theme;
  }
}
