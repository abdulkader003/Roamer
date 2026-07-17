import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Subscription } from 'rxjs';
import { TripPlanningService, TripRealtimeEvent } from '../../services/trip-planning.service';
import { FriendNotificationService } from '../../services/friend-notification.service';

type SpendingPoint = { label: string; amount: number };
type DistributionCategory = { name: string; amount: number; color: string };
type CategoryBudget = {
  categoryKey: string;
  name: string;
  spent: number;
  budget: number;
  percentage: number;
  status: 'Normal' | 'Near Limit' | 'Over Budget';
  statusClass: 'normal' | 'near-limit' | 'over-limit';
};
type CategoryBudgetDraft = {
  categoryKey: string;
  name: string;
  budget: string;
};
type CategoryBudgetResponse = {
  category: string;
  spent: number;
  budget: number;
  percentage: number;
  isNearLimit?: boolean;
  nearLimit?: boolean;
  isOverLimit?: boolean;
  overLimit?: boolean;
};
type TripBudget = {
  tripId: number;
  name: string;
  destination: string;
  budget: number;
  spent: number;
  remaining: number;
  status: 'Under Budget' | 'Near Limit' | 'Over Budget';
  flightTotal?: number;
  hotelTotal?: number;
  foodTotal?: number;
  transportTotal?: number;
  activitiesTotal?: number;
  othersTotal?: number;
};
type ManualExpense = {
  id: number;
  tripId: number;
  tripName: string;
  tripDestination: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
};
type BudgetReport = {
  totalBudget: number;
  totalSpent: number;
  remainingBalance: number;
  usagePercentage: number;
  categories: Array<{
    category: string;
    spent: number;
    budget: number;
    percentage: number;
    isNearLimit?: boolean;
    nearLimit?: boolean;
    isOverLimit?: boolean;
    overLimit?: boolean;
  }>;
  trips: TripBudget[];
};

@Component({
  selector: 'app-budget-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-tracker.html',
  styleUrl: './budget-tracker.css'
})
export class BudgetTracker implements OnInit, OnDestroy {
  private readonly apiBase = '/api/budget';
  private readonly tripPlanningService = inject(TripPlanningService);
  private readonly friendNotificationService = inject(FriendNotificationService);
  private readonly tripTopicSubscriptions = new Map<number, Subscription>();

  isLoading = true;
  loadError = '';
  isExporting = false;

  // ── User Story #1 — Budget Summary ──
  totalBudget = 0;
  totalSpent = 0;

  get remainingBalance(): number {
    return this.totalBudget - this.totalSpent;
  }

  get usagePercentage(): number {
    return this.totalBudget === 0 ? 0 : Math.round((this.totalSpent / this.totalBudget) * 100);
  }

  get usageProgressWidth(): number {
    return Math.min(this.usagePercentage, 100);
  }

  get usageStatusLabel(): 'Normal' | 'Near Limit' | 'Over Budget' {
    if (this.usagePercentage >= 100) return 'Over Budget';
    if (this.usagePercentage >= 75) return 'Near Limit';
    return 'Normal';
  }

  get usageStatusClass(): 'normal' | 'near-limit' | 'over-limit' {
    if (this.usagePercentage >= 100) return 'over-limit';
    if (this.usagePercentage >= 75) return 'near-limit';
    return 'normal';
  }

  // ── User Story #2 — Spending Overview Chart ──
  chartView: 'monthly' | 'yearly' = 'monthly';

  monthlySpending: SpendingPoint[] = [];
  yearlySpending: SpendingPoint[] = [];

  // Chart drawing constants (viewBox 0 0 720 320)
  readonly chartWidth = 720;
  private readonly chartHeight = 320;
  private readonly chartPaddingX = 34;
  private readonly chartPaddingTop = 30;
  private readonly chartPaddingBottom = 56;

  setChartView(view: 'monthly' | 'yearly'): void {
    this.chartView = view;
    this.loadSpendingChart(view);
  }

  get chartData() {
    return this.chartView === 'monthly' ? this.monthlySpending : this.yearlySpending;
  }

  get chartMax(): number {
    if (!this.chartData.length) return 100;
    const max = Math.max(...this.chartData.map(d => d.amount));
    return Math.ceil((max * 1.12) / 100) * 100 || 100;
  }

  get chartAxisStartX(): number {
    return this.chartPaddingX;
  }

  get chartAxisEndX(): number {
    return this.chartWidth - this.chartPaddingX;
  }

  get chartBaselineY(): number {
    return this.chartHeight - this.chartPaddingBottom;
  }

  get chartGridLines() {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const ratio = index / steps;
      return {
        y: this.chartPaddingTop + ratio * (this.chartBaselineY - this.chartPaddingTop),
        isBaseline: index === steps
      };
    });
  }

  get chartPoints() {
    const data = this.chartData;
    if (!data.length) return [];
    const innerWidth = this.chartWidth - this.chartPaddingX * 2;
    const innerHeight = this.chartHeight - this.chartPaddingTop - this.chartPaddingBottom;
    const max = this.chartMax;
    const divisor = Math.max(data.length - 1, 1);

    return data.map((d, i) => {
      const x = this.chartPaddingX + (i * innerWidth) / divisor;
      const y = this.chartPaddingTop + innerHeight - (d.amount / max) * innerHeight;
      return {
        x,
        y,
        label: d.label,
        amount: d.amount,
        labelLeftPercent: (x / this.chartWidth) * 100
      };
    });
  }

  get linePathD(): string {
    return this.chartPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }

  get areaPathD(): string {
    const points = this.chartPoints;
    if (!points.length) return '';
    const bottomY = this.chartBaselineY;
    const first = points[0];
    const last = points[points.length - 1];
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return `${line} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }

  get chartViewBox(): string {
    return `0 0 ${this.chartWidth} ${this.chartHeight}`;
  }

  // ── User Story #3 — Spending Distribution (Donut Chart) ──
  categories: DistributionCategory[] = [];

  private readonly categoryColors: Record<string, string> = {
    FLIGHTS: 'var(--budget-chart-flights)',
    HOTELS: 'var(--budget-chart-hotels)',
    FOOD: 'var(--budget-chart-food)',
    ACTIVITIES: 'var(--budget-chart-activities)',
    OTHERS: 'var(--budget-chart-others)'
  };

  private readonly categoryNames: Record<string, string> = {
    FLIGHTS: 'Flights',
    HOTELS: 'Hotels',
    FOOD: 'Food',
    ACTIVITIES: 'Activities',
    OTHERS: 'Others'
  };

  private donutRadius = 70;
  donutStrokeWidth = 34;

  get donutCircumference(): number {
    return 2 * Math.PI * this.donutRadius;
  }

  get categoryTotal(): number {
    return this.categories.reduce((sum, c) => sum + c.amount, 0);
  }

  get donutSegments() {
    const circumference = this.donutCircumference;
    const total = this.categoryTotal;
    let cumulative = 0;

    return this.categories.map(c => {
      const percentage = total > 0 ? (c.amount / total) * 100 : 0;
      const dash = (percentage / 100) * circumference;
      const offset = -((cumulative / 100) * circumference);
      cumulative += percentage;

      return {
        ...c,
        percentage: Math.round(percentage),
        precisePercentage: percentage.toFixed(1),
        dasharray: `${dash} ${circumference - dash}`,
        dashoffset: offset
      };
    });
  }

  // ── User Story #4 — Budget by Category ──
  categoryBudgets: CategoryBudget[] = [];
  isCategoryBudgetFormOpen = false;
  categoryBudgetDrafts: CategoryBudgetDraft[] = [];

  // ── User Story #5 — Manual Expenses List / Edit ──
  manualExpenses: ManualExpense[] = [];
  isEditingExpense = false;
  editingExpenseId: number | null = null;
  deleteConfirmationExpense: ManualExpense | null = null;

  // ── Trip Price Check Modal ──
  isTripPricesOpen = false;
  selectedTripDetails: TripBudget | null = null;

  get categoryBudgetRows() {
    return this.categoryBudgets;
  }

  get categoryBudgetFormTitle(): string {
    return 'Edit Category Budgets';
  }

  openCategoryBudgetForm(): void {
    this.categoryBudgetDrafts = this.categoryBudgets.map(category => ({
      categoryKey: category.categoryKey,
      name: category.name,
      budget: String(category.budget ?? 0)
    }));
    this.isCategoryBudgetFormOpen = true;
  }

  closeCategoryBudgetForm(): void {
    this.isCategoryBudgetFormOpen = false;
    this.categoryBudgetDrafts = [];
  }

  saveCategoryBudget(): void {
    if (!this.categoryBudgetDrafts.length) {
      return;
    }

    const updates = this.categoryBudgetDrafts.map((draft, index) => ({
      draft,
      budget: Number(draft.budget),
      current: this.categoryBudgets[index]
    }));

    if (updates.some(update => Number.isNaN(update.budget) || update.budget < 0)) {
      return;
    }

    const changedUpdates = updates.filter(update => !update.current || update.current.budget !== update.budget);

    if (!changedUpdates.length) {
      this.closeCategoryBudgetForm();
      return;
    }

    forkJoin(
      changedUpdates.map(update =>
        this.http.put<CategoryBudgetResponse>(
          `${this.apiBase}/categories/${update.draft.categoryKey}`,
          { budget: update.budget },
          { headers: this.getHeaders() }
        )
      )
    ).subscribe({
      next: (responses) => {
        this.categoryBudgets = this.mergeSavedCategoryBudgets(this.categoryBudgets, responses);
        this.closeCategoryBudgetForm();
        this.loadError = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadError = 'Failed to save category budget. Please try again.';
        this.cdr.detectChanges();
        alert(this.loadError);
      }
    });
  }

  // -- User Story 5 -- Add Manual Expense --
  isExpenseFormOpen = false;
  isExpenseCategoryMenuOpen = false;
  isExpenseDatePickerOpen = false;
  isExpenseTripMenuOpen = false;
  expenseCalendarMonth = new Date();

  expenseDraft = {
    amount: '',
    category: 'Flights',
    description: '',
    date: '',
    tripId: null as number | null
  };

  expenseCategories = ['Flights', 'Hotels', 'Food', 'Activities', 'Others'];
  readonly expenseCalendarWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  get selectedExpenseCategoryOptionId(): string {
    return `expense-category-${this.expenseDraft.category.toLowerCase()}`;
  }

  get selectedExpenseTripOptionId(): string {
    return this.expenseDraft.tripId ? `expense-trip-${this.expenseDraft.tripId}` : '';
  }

  get selectedExpenseTripLabel(): string {
    const trip = this.trips.find(t => t.tripId === this.expenseDraft.tripId);
    return trip ? `${trip.name} - ${trip.destination}` : 'Select trip';
  }

  get expenseDateLabel(): string {
    const selected = this.parseDateString(this.expenseDraft.date);
    if (!selected) return 'Select date';
    return selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  get expenseCalendarMonthLabel(): string {
    return this.expenseCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get expenseCalendarDays() {
    const year = this.expenseCalendarMonth.getFullYear();
    const month = this.expenseCalendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
    const selectedDate = this.expenseDraft.date;
    const today = this.formatDateValue(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const value = this.formatDateValue(date);

      return {
        value,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isSelected: value === selectedDate,
        isToday: value === today
      };
    });
  }

  get expenseModalTitle(): string {
    return this.isEditingExpense ? 'Edit Manual Expense' : 'Add Manual Expense';
  }

  get expenseSubmitLabel(): string {
    return this.isEditingExpense ? 'Save Changes' : 'Save Expense';
  }

  openExpenseForm(expense?: ManualExpense): void {
    this.isEditingExpense = Boolean(expense);
    this.editingExpenseId = expense?.id ?? null;
    this.expenseDraft = {
      amount: expense ? String(expense.amount) : '',
      category: expense ? expense.category : 'Flights',
      description: expense ? (expense.description ?? '') : '',
      date: expense ? expense.date : this.formatDateValue(new Date()),
      tripId: expense ? expense.tripId : this.trips[0]?.tripId ?? null
    };
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
    this.isExpenseTripMenuOpen = false;
    this.expenseCalendarMonth = this.parseDateString(this.expenseDraft.date) ?? new Date();
    this.isExpenseFormOpen = true;
  }

  closeExpenseForm(): void {
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
    this.isExpenseTripMenuOpen = false;
    this.isExpenseFormOpen = false;
    this.isEditingExpense = false;
    this.editingExpenseId = null;
    this.deleteConfirmationExpense = null;
  }

  handleExpenseModalClick(event: MouseEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.expense-category-menu')) {
      this.isExpenseCategoryMenuOpen = false;
    }
    if (!target?.closest('.expense-date-picker')) {
      this.isExpenseDatePickerOpen = false;
    }
    if (!target?.closest('.expense-trip-menu')) {
      this.isExpenseTripMenuOpen = false;
    }
  }

  toggleExpenseCategoryMenu(): void {
    this.isExpenseCategoryMenuOpen = !this.isExpenseCategoryMenuOpen;
    this.isExpenseTripMenuOpen = false;
  }

  selectExpenseCategory(category: string): void {
    this.expenseDraft.category = category;
    this.isExpenseCategoryMenuOpen = false;
  }

  toggleExpenseTripMenu(): void {
    this.isExpenseTripMenuOpen = !this.isExpenseTripMenuOpen;
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
  }

  selectExpenseTrip(tripId: number): void {
    this.expenseDraft.tripId = tripId;
    this.isExpenseTripMenuOpen = false;
  }

  toggleExpenseDatePicker(): void {
    this.isExpenseDatePickerOpen = !this.isExpenseDatePickerOpen;
    this.isExpenseTripMenuOpen = false;
    const selected = this.parseDateString(this.expenseDraft.date);
    if (selected) {
      this.expenseCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    }
  }

  changeExpenseCalendarMonth(offset: number): void {
    this.expenseCalendarMonth = new Date(
      this.expenseCalendarMonth.getFullYear(),
      this.expenseCalendarMonth.getMonth() + offset,
      1
    );
  }

  selectExpenseDate(value: string): void {
    this.expenseDraft.date = value;
    const selected = this.parseDateString(value);
    if (selected) {
      this.expenseCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    }
    this.isExpenseDatePickerOpen = false;
  }

  private parseDateString(value: string): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  saveExpense(): void {
    const amount = Number(this.expenseDraft.amount);
    if (!amount || amount <= 0 || !this.expenseDraft.category || !this.expenseDraft.date) {
      return;
    }

    const categoryKey = this.expenseDraft.category.toUpperCase();

    const payload = {
      tripId: this.expenseDraft.tripId,
      category: categoryKey,
      amount: amount,
      description: this.expenseDraft.description || null,
      date: this.expenseDraft.date
    };

    if (!payload.tripId) {
      alert('No trip found. Please create a trip first.');
      return;
    }

    const request = this.isEditingExpense && this.editingExpenseId !== null
      ? this.http.put(`${this.apiBase}/expenses/${this.editingExpenseId}`, payload, { headers: this.getHeaders() })
      : this.http.post(`${this.apiBase}/expenses`, payload, { headers: this.getHeaders() });

    request.subscribe({
      next: () => {
        this.closeExpenseForm();
        this.loadAllData();
        this.friendNotificationService.refresh();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadError = 'Failed to save expense. Please try again.';
        this.cdr.detectChanges();
        alert(this.loadError);
      }
    });
  }

  deleteExpense(): void {
    if (!this.isEditingExpense || this.editingExpenseId === null) {
      return;
    }

    const expense = this.manualExpenses.find(item => item.id === this.editingExpenseId) ?? null;
    if (!expense) {
      return;
    }

    this.deleteConfirmationExpense = expense;
  }

  closeDeleteExpenseConfirmation(): void {
    this.deleteConfirmationExpense = null;
  }

  confirmDeleteExpense(): void {
    if (!this.deleteConfirmationExpense) {
      return;
    }

    const expenseId = this.deleteConfirmationExpense.id;
    this.http.delete(`${this.apiBase}/expenses/${expenseId}`, { headers: this.getHeaders() }).subscribe({
      next: () => {
        this.deleteConfirmationExpense = null;
        this.closeExpenseForm();
        this.loadAllData();
        this.friendNotificationService.refresh();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadError = 'Failed to delete expense. Please try again.';
        this.cdr.detectChanges();
        alert(this.loadError);
      }
    });
  }

  // -- User Story 6 -- Recent Trip Budgets --
  tripStatusFilter: 'All' | 'Under Budget' | 'Near Limit' | 'Over Budget' = 'All';
  isTripFilterOpen = false;

  readonly tripStatusOptions: Array<{ value: 'All' | 'Under Budget' | 'Near Limit' | 'Over Budget'; label: string; id: string }> = [
    { value: 'All', label: 'All Statuses', id: 'trip-filter-all' },
    { value: 'Under Budget', label: 'Under Budget', id: 'trip-filter-under-budget' },
    { value: 'Near Limit', label: 'Near Limit', id: 'trip-filter-near-limit' },
    { value: 'Over Budget', label: 'Over Budget', id: 'trip-filter-over-budget' }
  ];

  @HostListener('document:click', ['$event'])
  closeMenusOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.trip-filter-menu')) {
      this.isTripFilterOpen = false;
    }
    if (!target?.closest('.expense-category-menu')) {
      this.isExpenseCategoryMenuOpen = false;
    }
    if (!target?.closest('.expense-date-picker')) {
      this.isExpenseDatePickerOpen = false;
    }
    if (!target?.closest('.expense-trip-menu')) {
      this.isExpenseTripMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  closeMenusOnEscape(): void {
    this.isTripFilterOpen = false;
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
    this.isExpenseTripMenuOpen = false;
    this.deleteConfirmationExpense = null;
    this.closeCategoryBudgetForm();
  }

  get selectedTripStatusLabel(): string {
    return this.tripStatusOptions.find(option => option.value === this.tripStatusFilter)?.label ?? 'All Statuses';
  }

  get selectedTripStatusOptionId(): string {
    return this.tripStatusOptions.find(option => option.value === this.tripStatusFilter)?.id ?? 'trip-filter-all';
  }

  toggleTripFilterMenu(): void {
    this.isTripFilterOpen = !this.isTripFilterOpen;
  }

  selectTripStatusFilter(value: 'All' | 'Under Budget' | 'Near Limit' | 'Over Budget'): void {
    this.tripStatusFilter = value;
    this.isTripFilterOpen = false;
  }

  trips: TripBudget[] = [];

  get tripLookup(): Map<number, TripBudget> {
    return new Map(this.trips.map(trip => [trip.tripId, trip]));
  }

  get tripBreakdownRows() {
    if (!this.selectedTripDetails) {
      return [];
    }

    return [
      { label: 'Flight', amount: this.selectedTripDetails.flightTotal ?? 0 },
      { label: 'Hotel', amount: this.selectedTripDetails.hotelTotal ?? 0 },
      { label: 'Food', amount: this.selectedTripDetails.foodTotal ?? 0 },
      { label: 'Activities', amount: this.selectedTripDetails.activitiesTotal ?? 0 },
      { label: 'Others', amount: this.selectedTripDetails.othersTotal ?? 0 },
      { label: 'Total Used', amount: this.selectedTripDetails.spent },
      { label: 'Remaining', amount: this.selectedTripDetails.remaining }
    ];
  }

  openTripPrices(trip: TripBudget): void {
    this.selectedTripDetails = trip;
    this.isTripPricesOpen = true;
  }

  closeTripPrices(): void {
    this.isTripPricesOpen = false;
    this.selectedTripDetails = null;
  }

  get tripRows() {
    return this.trips.map(t => ({
      ...t,
      statusClass: t.status === 'Over Budget' ? 'over-limit' : t.status === 'Near Limit' ? 'near-limit' : 'normal'
    }));
  }

  get filteredTripRows() {
    if (this.tripStatusFilter === 'All') {
      return this.tripRows;
    }
    return this.tripRows.filter(t => t.status === this.tripStatusFilter);
  }

  // -- User Story 7 -- Export Budget Report --
  isExportMenuOpen = false;

  toggleExportMenu(): void {
    this.isExportMenuOpen = !this.isExportMenuOpen;
  }

  closeExportMenu(): void {
    this.isExportMenuOpen = false;
  }

  exportReport(format: 'pdf' | 'csv'): void {
    this.isExporting = true;
    this.loadError = '';
    const reportWindow = format === 'pdf' ? window.open('', '_blank') : null;

    if (format === 'pdf' && !reportWindow) {
      this.isExporting = false;
      this.loadError = 'Failed to open the PDF report window. Please allow popups and try again.';
      this.closeExportMenu();
      this.cdr.detectChanges();
      return;
    }

    this.http.get<BudgetReport>(`${this.apiBase}/report`, { headers: this.getHeaders() }).subscribe({
      next: report => {
        if (format === 'csv') {
          this.exportAsCsv(report);
        } else {
          this.exportAsPdf(report, reportWindow);
        }
        this.isExporting = false;
        this.closeExportMenu();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isExporting = false;
        this.loadError = 'Failed to export budget report. Please try again.';
        this.closeExportMenu();
        reportWindow?.close();
        this.cdr.detectChanges();
      }
    });
  }

  private exportAsCsv(report: BudgetReport): void {
    const lines: string[] = [];
    const csvCell = (value: string | number): string => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csvRow = (values: Array<string | number>): string => values.map(csvCell).join(',');

    lines.push(csvRow(['Budget Summary']));
    lines.push(csvRow(['Total Budget', this.formatReportMoney(report.totalBudget)]));
    lines.push(csvRow(['Total Spent', this.formatReportMoney(report.totalSpent)]));
    lines.push(csvRow(['Remaining Balance', this.formatReportMoney(report.remainingBalance)]));
    lines.push(csvRow(['Budget Usage', `${Number(report.usagePercentage)}%`]));
    lines.push('');

    lines.push(csvRow(['Category Breakdown']));
    lines.push(csvRow(['Category', 'Spent', 'Budget', 'Percentage']));
    this.mapCategoryBudgets(report.categories).forEach(c => {
      lines.push(csvRow([c.name, this.formatReportMoney(c.spent), this.formatReportMoney(c.budget), `${c.percentage}%`]));
    });
    lines.push('');

    lines.push(csvRow(['Trip List']));
    lines.push(csvRow(['Trip Name', 'Destination', 'Budget', 'Spent', 'Remaining', 'Status']));
    this.mapTrips(report.trips).forEach(t => {
      lines.push(csvRow([t.name, t.destination, this.formatReportMoney(t.budget), this.formatReportMoney(t.spent), this.formatReportMoney(t.remaining), t.status]));
    });

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private exportAsPdf(report: BudgetReport, reportWindow: Window | null): void {
    if (!reportWindow) return;

    const categoryRowsHtml = this.mapCategoryBudgets(report.categories)
      .map(c => `<tr><td>${this.escapeHtml(c.name)}</td><td>${this.formatReportMoney(c.spent)}</td><td>${this.formatReportMoney(c.budget)}</td><td>${c.percentage}%</td></tr>`)
      .join('');

    const tripRowsHtml = this.mapTrips(report.trips)
      .map(t => `<tr><td>${this.escapeHtml(t.name)}</td><td>${this.escapeHtml(t.destination)}</td><td>${this.formatReportMoney(t.budget)}</td><td>${this.formatReportMoney(t.spent)}</td><td>${this.formatReportMoney(t.remaining)}</td><td>${this.escapeHtml(t.status)}</td></tr>`)
      .join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>Budget Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1A1D2E; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 28px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
            th { background: #F4F6FB; }
            .summary-line { font-size: 14px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Budget Report</h1>
          <p class="summary-line">Total Budget: ${this.formatReportMoney(report.totalBudget)}</p>
          <p class="summary-line">Total Spent: ${this.formatReportMoney(report.totalSpent)}</p>
          <p class="summary-line">Remaining Balance: ${this.formatReportMoney(report.remainingBalance)}</p>
          <p class="summary-line">Budget Usage: ${Number(report.usagePercentage)}%</p>
          <h2>Category Breakdown</h2>
          <table>
            <thead><tr><th>Category</th><th>Spent</th><th>Budget</th><th>Percentage</th></tr></thead>
            <tbody>${categoryRowsHtml}</tbody>
          </table>
          <h2>Trip List</h2>
          <table>
            <thead><tr><th>Trip Name</th><th>Destination</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>${tripRowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  // ── HTTP / Data Loading ──
  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    for (const subscription of this.tripTopicSubscriptions.values()) {
      subscription.unsubscribe();
    }

    this.tripTopicSubscriptions.clear();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('sep.auth.token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadAllData(): void {
    this.isLoading = true;
    this.loadError = '';

    forkJoin({
      summary: this.http.get<any>(`${this.apiBase}/summary`, { headers: this.getHeaders() }),
      monthly: this.http.get<any[]>(`${this.apiBase}/spending-over-time?view=monthly`, { headers: this.getHeaders() }),
      yearly: this.http.get<any[]>(`${this.apiBase}/spending-over-time?view=yearly`, { headers: this.getHeaders() }),
      distribution: this.http.get<any[]>(`${this.apiBase}/distribution`, { headers: this.getHeaders() }),
      categories: this.http.get<any[]>(`${this.apiBase}/categories`, { headers: this.getHeaders() }),
      trips: this.http.get<TripBudget[]>(`${this.apiBase}/trips`, { headers: this.getHeaders() }),
      expenses: this.http.get<any[]>(`${this.apiBase}/expenses`, { headers: this.getHeaders() })
    }).subscribe({
      next: data => {
        const tripLookup = new Map(data.trips.map((trip: TripBudget) => [trip.tripId, trip]));
        this.totalBudget = Number(data.summary.totalBudget);
        this.totalSpent = Number(data.summary.totalSpent);
        this.monthlySpending = this.mapSpendingPoints(data.monthly);
        this.yearlySpending = this.mapSpendingPoints(data.yearly);
        this.categories = this.mapDistribution(data.distribution);
        this.categoryBudgets = this.mapCategoryBudgets(data.categories);
        this.trips = this.mapTrips(data.trips);
        this.syncTripTopicSubscriptions(this.trips.map((trip) => trip.tripId));
        this.manualExpenses = this.mapExpenses(data.expenses, tripLookup);
        this.expenseDraft.tripId = this.trips.some(trip => trip.tripId === this.expenseDraft.tripId)
          ? this.expenseDraft.tripId
          : this.trips[0]?.tripId ?? null;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Failed to load budget data. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  private syncTripTopicSubscriptions(tripIds: number[]): void {
    const nextTripIds = new Set(tripIds);

    for (const [tripId, subscription] of this.tripTopicSubscriptions.entries()) {
      if (nextTripIds.has(tripId)) {
        continue;
      }

      subscription.unsubscribe();
      this.tripTopicSubscriptions.delete(tripId);
    }

    for (const tripId of nextTripIds) {
      if (this.tripTopicSubscriptions.has(tripId)) {
        continue;
      }

      const subscription = this.tripPlanningService.observeTripTopicUpdates(tripId).subscribe((event: TripRealtimeEvent) => {
        this.loadAllData();
      });

      this.tripTopicSubscriptions.set(tripId, subscription);
    }
  }

  private loadSpendingChart(view: 'monthly' | 'yearly'): void {
    this.http.get<any[]>(`${this.apiBase}/spending-over-time?view=${view}`, { headers: this.getHeaders() }).subscribe({
      next: data => {
        const points = this.mapSpendingPoints(data);
        if (view === 'monthly') {
          this.monthlySpending = points;
        } else {
          this.yearlySpending = points;
        }
      },
      error: () => {
        this.loadError = 'Failed to load spending chart data. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  private mapSpendingPoints(data: any[]): SpendingPoint[] {
    return data.map(d => ({ label: d.label, amount: Number(d.amount) }));
  }

  private mapDistribution(data: any[]): DistributionCategory[] {
    return data.map(d => ({
      name: this.categoryNames[this.normalizeCategoryKey(String(d.category ?? ''))] ?? d.category,
      amount: Number(d.amount),
      color: this.categoryColors[this.normalizeCategoryKey(String(d.category ?? ''))] ?? '#999'
    }));
  }

  private mapCategoryBudgets(data: any[]): CategoryBudget[] {
    return data.map(d => {
      const isOverLimit = Boolean(d.isOverLimit ?? d.overLimit);
      const isNearLimit = Boolean(d.isNearLimit ?? d.nearLimit);
      const percentage = Number.isFinite(Number(d.percentage)) ? Number(d.percentage) : 0;
      const status = isOverLimit ? 'Over Budget' : isNearLimit ? 'Near Limit' : 'Normal';
      const statusClass = isOverLimit ? 'over-limit' : isNearLimit ? 'near-limit' : 'normal';

      return {
        categoryKey: this.normalizeCategoryKey(String(d.category ?? '')),
        name: this.categoryNames[this.normalizeCategoryKey(String(d.category ?? ''))] ?? d.category,
        spent: Number(d.spent),
        budget: Number(d.budget),
        percentage: Math.min(Math.max(percentage, 0), 100),
        status,
        statusClass
      };
    });
  }

  private mergeSavedCategoryBudgets(current: CategoryBudget[], responses: CategoryBudgetResponse[]): CategoryBudget[] {
    const updates = new Map<string, CategoryBudgetResponse>();

    responses.forEach(response => {
      if (!response?.category) {
        return;
      }

      updates.set(this.normalizeCategoryKey(response.category), response);
    });

    return current.map(category => {
      const update = updates.get(category.categoryKey);
      if (!update) {
        return category;
      }

      const isOverLimit = Boolean(update.isOverLimit ?? update.overLimit);
      const isNearLimit = Boolean(update.isNearLimit ?? update.nearLimit);
      const percentage = Number.isFinite(Number(update.percentage)) ? Number(update.percentage) : category.percentage;

      return {
        ...category,
        spent: Number(update.spent ?? category.spent),
        budget: Number(update.budget ?? category.budget),
        percentage: Math.min(Math.max(percentage, 0), 100),
        status: isOverLimit ? 'Over Budget' : isNearLimit ? 'Near Limit' : 'Normal',
        statusClass: isOverLimit ? 'over-limit' : isNearLimit ? 'near-limit' : 'normal'
      };
    });
  }

  private mapTrips(data: TripBudget[]): TripBudget[] {
    return data.map(t => ({
      tripId: t.tripId,
      name: t.name,
      destination: t.destination,
      budget: Number(t.budget),
      spent: Number(t.spent),
      remaining: Number(t.remaining),
      status: t.status,
      flightTotal: Number(t.flightTotal ?? 0),
      hotelTotal: Number(t.hotelTotal ?? 0),
      foodTotal: Number(t.foodTotal ?? 0),
      activitiesTotal: Number(t.activitiesTotal ?? 0),
      othersTotal: Number(t.othersTotal ?? 0)
    }));
  }

  private mapExpenses(data: any[], tripLookup: Map<number, TripBudget>): ManualExpense[] {
    return data.map(expense => {
      const trip = tripLookup.get(Number(expense.tripId));
      return {
        id: Number(expense.id),
        tripId: Number(expense.tripId),
        tripName: trip?.name ?? 'Trip',
        tripDestination: trip?.destination ?? '',
        category: this.expenseCategoryLabel(String(expense.category ?? '')),
        amount: Number(expense.amount),
        description: expense.description ?? null,
        date: String(expense.date ?? '')
      };
    });
  }

  private expenseCategoryLabel(category: string): string {
    const normalized = this.normalizeCategoryKey(category);
    return this.categoryNames[normalized] ?? category;
  }

  private normalizeCategoryKey(category: string): string {
    const normalized = category.toUpperCase();
    return normalized === 'TRANSPORT' ? 'OTHERS' : normalized;
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatReportMoney(value: string | number | null | undefined): string {
    return `${Number(value ?? 0).toFixed(2)} EUR`;
  }
}
