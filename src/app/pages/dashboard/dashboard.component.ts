import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { Transaction, TransactionType } from '../../models/transaction.model';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly themeStorageKey = 'mobile-sales-theme';
  private readonly formBuilder = inject(FormBuilder);
  private readonly transactionService = inject(TransactionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<TransactionType>('sale');
  protected readonly sales = signal<Transaction[]>([]);
  protected readonly services = signal<Transaction[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly recordPendingDelete = signal<Transaction | null>(null);
  protected readonly selectedMonth = signal(new Date().toISOString().slice(0, 7));
  protected readonly themeColor = signal('#f5c58b');
  protected readonly showThemePicker = signal(false);
  protected readonly currentUser = this.authService.getCurrentUser();

  protected readonly transactionForm = this.formBuilder.nonNullable.group({
    customerName: ['', Validators.required],
    phoneModel: ['', Validators.required],
    brand: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    profit: [0, [Validators.required, Validators.min(0)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: ['']
  });

  protected readonly currentRecords = computed(() =>
    this.activeTab() === 'sale' ? this.sales() : this.services()
  );

  protected readonly monthlyRecords = computed(() =>
    this.currentRecords().filter((item) => item.date.startsWith(this.selectedMonth()))
  );

  protected readonly totalAmount = computed(() =>
    this.monthlyRecords().reduce((sum, item) => sum + Number(item.amount), 0)
  );

  protected readonly totalProfit = computed(() =>
    this.monthlyRecords().reduce((sum, item) => sum + Number(item.profit ?? 0), 0)
  );

  protected readonly monthGroups = computed(() => {
    const map = new Map<string, { month: string; count: number; total: number }>();

    for (const item of this.currentRecords()) {
      const month = item.date.slice(0, 7);
      const existing = map.get(month) ?? { month, count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(item.amount);
      map.set(month, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  });

  ngOnInit(): void {
    this.initializeTheme();
    this.loadTransactions('sale');
    this.loadTransactions('service');
  }

  protected switchTab(tab: TransactionType): void {
    this.activeTab.set(tab);
    this.editingId.set(null);
    this.transactionForm.reset({
      customerName: '',
      phoneModel: '',
      brand: '',
      amount: 0,
      profit: 0,
      date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    this.statusMessage.set('');
  }

  protected submit(): void {
    if (this.transactionForm.invalid || this.isSaving()) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const payload: Transaction = {
      type: this.activeTab(),
      ...this.transactionForm.getRawValue()
    };

    this.isSaving.set(true);
    const request = this.editingId()
      ? this.transactionService.updateTransaction(this.editingId()!, payload)
      : this.transactionService.createTransaction(payload);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.statusMessage.set(
          this.editingId()
            ? `${this.labelFor(this.activeTab())} updated successfully.`
            : `${this.labelFor(this.activeTab())} created successfully.`
        );
        this.switchTab(this.activeTab());
        this.loadTransactions(this.activeTab());
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.statusMessage.set(this.resolveSaveError(error));
      }
    });
  }

  protected editRecord(record: Transaction): void {
    this.activeTab.set(record.type);
    this.editingId.set(record._id ?? null);
    this.transactionForm.reset({
      customerName: record.customerName,
      phoneModel: record.phoneModel,
      brand: record.brand,
      amount: Number(record.amount),
      profit: Number(record.profit ?? 0),
      date: record.date,
      notes: record.notes
    });
    this.statusMessage.set(`Editing ${this.labelFor(record.type).toLowerCase()} for ${record.customerName}.`);
  }

  protected promptDelete(record: Transaction): void {
    this.recordPendingDelete.set(record);
  }

  protected cancelDelete(): void {
    this.recordPendingDelete.set(null);
  }

  protected confirmDelete(): void {
    const record = this.recordPendingDelete();

    if (!record?._id) {
      this.recordPendingDelete.set(null);
      return;
    }

    this.transactionService.deleteTransaction(record._id).subscribe({
      next: () => {
        this.statusMessage.set(`${this.labelFor(record.type)} deleted successfully.`);
        this.loadTransactions(record.type);
        if (this.editingId() === record._id) {
          this.switchTab(record.type);
        }
        this.recordPendingDelete.set(null);
      },
      error: () => {
        this.statusMessage.set(`Unable to delete ${this.labelFor(record.type).toLowerCase()}.`);
        this.recordPendingDelete.set(null);
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  protected onMonthChange(value: string): void {
    this.selectedMonth.set(value || new Date().toISOString().slice(0, 7));
  }

  protected toggleThemePicker(): void {
    this.showThemePicker.update((value) => !value);
  }

  protected updateThemeColor(value: string): void {
    this.themeColor.set(value);
    localStorage.setItem(this.themeStorageKey, value);
    this.applyTheme(value);
  }

  protected formatMonth(month: string): string {
    const [year, monthPart] = month.split('-').map(Number);
    return new Date(year, monthPart - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
  }

  protected labelFor(type: TransactionType): string {
    return type === 'sale' ? 'Sale record' : 'Service ticket';
  }

  private loadTransactions(type: TransactionType): void {
    this.isLoading.set(true);
    this.transactionService.getTransactions(type).subscribe({
      next: (records) => {
        if (type === 'sale') {
          this.sales.set(records);
        } else {
          this.services.set(records);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.statusMessage.set(`Unable to load ${type} data.`);
        this.isLoading.set(false);
      }
    });
  }

  private resolveSaveError(error?: HttpErrorResponse): string {
    const apiMessage = error?.error?.error || error?.error?.message;
    return apiMessage
      ? `Unable to save ${this.labelFor(this.activeTab()).toLowerCase()}: ${apiMessage}`
      : `Unable to save ${this.labelFor(this.activeTab()).toLowerCase()}. Please restart the API server and try again.`;
  }

  private initializeTheme(): void {
    const storedTheme = localStorage.getItem(this.themeStorageKey) ?? '#f5c58b';
    this.themeColor.set(storedTheme);
    this.applyTheme(storedTheme);
  }

  private applyTheme(hex: string): void {
    const root = document.documentElement;
    const accentStrong = this.adjustColor(hex, -22);
    const accentRgb = this.hexToRgb(hex);

    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-strong', accentStrong);
    root.style.setProperty('--accent-soft', `rgba(${accentRgb}, 0.18)`);
    root.style.setProperty('--accent-rgb', accentRgb);
  }

  private adjustColor(hex: string, amount: number): string {
    const normalized = hex.replace('#', '');
    const value = Number.parseInt(normalized, 16);
    const clamp = (channel: number) => Math.max(0, Math.min(255, channel + amount));

    const red = clamp((value >> 16) & 255);
    const green = clamp((value >> 8) & 255);
    const blue = clamp(value & 255);

    return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  private hexToRgb(hex: string): string {
    const normalized = hex.replace('#', '');
    const value = Number.parseInt(normalized, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;

    return `${red}, ${green}, ${blue}`;
  }
}
