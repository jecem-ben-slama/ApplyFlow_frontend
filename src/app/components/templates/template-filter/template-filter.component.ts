import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-template-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './template-filter.component.html',
})
export class TemplateFilterComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedLanguage: string | undefined = undefined;
  @Input() totalElements = 0;
  @Input() currentCount = 0;
  @Input() searchTerm = '';

  localSearchTerm = '';
  isInputFocused = false; // Prevents parent updates from stealing focus

  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  @Output() filterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();

  ngOnInit(): void {
    this.localSearchTerm = this.searchTerm;

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.searchChange.emit(term);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only update local value if the user is NOT currently typing/focused
    if (changes['searchTerm'] && !this.isInputFocused) {
      const parentVal = changes['searchTerm'].currentValue || '';
      if (parentVal !== this.localSearchTerm) {
        this.localSearchTerm = parentVal;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onFilterChange(lang: string): void {
    this.filterChange.emit(lang);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localSearchTerm = value;
    this.searchSubject.next(value);
  }

  onFocus(): void {
    this.isInputFocused = true;
  }

  onBlur(): void {
    this.isInputFocused = false;
  }
}
