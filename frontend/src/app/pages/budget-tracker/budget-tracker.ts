import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-budget-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-tracker.html',
  styleUrl: './budget-tracker.css'
})
export class BudgetTracker {
  private readonly nearLimitThreshold = 75;

  // Mock data for User Story #1 — Budget Summary
  totalBudget = 5000;
  totalSpent = 3200;

  get remainingBalance(): number {
    return this.totalBudget - this.totalSpent;
  }

  get usagePercentage(): number {
    return Math.round((this.totalSpent / this.totalBudget) * 100);
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

  monthlySpending = [
    { label: 'Jan', amount: 220 },
    { label: 'Feb', amount: 340 },
    { label: 'Mar', amount: 280 },
    { label: 'Apr', amount: 410 },
    { label: 'May', amount: 360 },
    { label: 'Jun', amount: 500 },
    { label: 'Jul', amount: 640 },
    { label: 'Aug', amount: 590 },
    { label: 'Sep', amount: 300 },
    { label: 'Oct', amount: 250 },
    { label: 'Nov', amount: 180 },
    { label: 'Dec', amount: 130 }
  ];

  yearlySpending = [
    { label: '2022', amount: 2800 },
    { label: '2023', amount: 3400 },
    { label: '2024', amount: 4100 },
    { label: '2025', amount: 4600 },
    { label: '2026', amount: 3200 }
  ];

  // Chart drawing constants (viewBox 0 0 720 320)
  readonly chartWidth = 720;
  private readonly chartHeight = 320;
  private readonly chartPaddingX = 34;
  private readonly chartPaddingTop = 30;
  private readonly chartPaddingBottom = 56;

  setChartView(view: 'monthly' | 'yearly'): void {
    this.chartView = view;
  }

  get chartData() {
    return this.chartView === 'monthly' ? this.monthlySpending : this.yearlySpending;
  }

  get chartMax(): number {
    const max = Math.max(...this.chartData.map(d => d.amount));
    return Math.ceil((max * 1.12) / 100) * 100;
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
  categories = [
    { name: 'Flights', amount: 1200, color: 'var(--budget-chart-flights)' },
    { name: 'Hotels', amount: 900, color: 'var(--budget-chart-hotels)' },
    { name: 'Food', amount: 650, color: 'var(--budget-chart-food)' },
    { name: 'Transport', amount: 300, color: 'var(--budget-chart-transport)' },
    { name: 'Activities', amount: 150, color: 'var(--budget-chart-activities)' }
  ];

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
  categoryBudgets = [
    { name: 'Flights', spent: 1200, budget: 1400 },
    { name: 'Hotels', spent: 900, budget: 1000 },
    { name: 'Food', spent: 650, budget: 800 },
    { name: 'Transport', spent: 300, budget: 600 },
    { name: 'Activities', spent: 150, budget: 500 }
  ];

  get categoryBudgetRows() {
    return this.categoryBudgets.map(c => {
      const percentage = Math.min(Math.round((c.spent / c.budget) * 100), 100);
      const rawPercentage = (c.spent / c.budget) * 100;
      const status = rawPercentage >= 100 ? 'Over Budget' : rawPercentage >= this.nearLimitThreshold ? 'Near Limit' : 'Normal';
      const statusClass = rawPercentage >= 100 ? 'over-limit' : rawPercentage >= this.nearLimitThreshold ? 'near-limit' : 'normal';

      return {
        ...c,
        percentage,
        status,
        statusClass
      };
    });
  }

  // -- User Story 5 -- Add Manual Expense --
  isExpenseFormOpen = false;
  isExpenseCategoryMenuOpen = false;
  isExpenseDatePickerOpen = false;
  expenseCalendarMonth = new Date();

  expenseDraft = {
    amount: '',
    category: 'Flights',
    description: '',
    date: ''
  };

  expenseCategories = ['Flights', 'Hotels', 'Food', 'Transport', 'Activities'];
  readonly expenseCalendarWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  get selectedExpenseCategoryOptionId(): string {
    return `expense-category-${this.expenseDraft.category.toLowerCase()}`;
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

  openExpenseForm(): void {
    this.expenseDraft = {
      amount: '',
      category: 'Flights',
      description: '',
      date: this.formatDateValue(new Date())
    };
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
    this.expenseCalendarMonth = new Date();
    this.isExpenseFormOpen = true;
  }

  closeExpenseForm(): void {
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
    this.isExpenseFormOpen = false;
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
  }

  toggleExpenseCategoryMenu(): void {
    this.isExpenseCategoryMenuOpen = !this.isExpenseCategoryMenuOpen;
  }

  selectExpenseCategory(category: string): void {
    this.expenseDraft.category = category;
    this.isExpenseCategoryMenuOpen = false;
  }

  toggleExpenseDatePicker(): void {
    this.isExpenseDatePickerOpen = !this.isExpenseDatePickerOpen;
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

    if (!amount || amount <= 0 || !this.expenseDraft.category) {
      return;
    }

    this.totalSpent += amount;

    const categoryBudget = this.categoryBudgets.find(c => c.name === this.expenseDraft.category);
    if (categoryBudget) {
      categoryBudget.spent += amount;
    }

    const donutCategory = this.categories.find(c => c.name === this.expenseDraft.category);
    if (donutCategory) {
      donutCategory.amount += amount;
    }

    if (this.monthlySpending.length > 0) {
      this.monthlySpending[this.monthlySpending.length - 1].amount += amount;
    }

    this.closeExpenseForm();
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
  }

  @HostListener('document:keydown.escape')
  closeMenusOnEscape(): void {
    this.isTripFilterOpen = false;
    this.isExpenseCategoryMenuOpen = false;
    this.isExpenseDatePickerOpen = false;
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

  trips = [
    { name: 'Summer Getaway', destination: 'Barcelona, Spain', budget: 1800, spent: 1200 },
    { name: 'Winter Escape', destination: 'Vienna, Austria', budget: 1200, spent: 1100 },
    { name: 'Business Trip', destination: 'Berlin, Germany', budget: 900, spent: 950 },
    { name: 'Weekend Trip', destination: 'Amsterdam, Netherlands', budget: 600, spent: 320 },
    { name: 'Family Vacation', destination: 'Rome, Italy', budget: 2200, spent: 1850 }
  ];

  private getTripStatus(budget: number, spent: number): 'Under Budget' | 'Near Limit' | 'Over Budget' {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return 'Over Budget';
    if (percentage >= this.nearLimitThreshold) return 'Near Limit';
    return 'Under Budget';
  }

  get tripRows() {
    return this.trips.map(t => {
      const status = this.getTripStatus(t.budget, t.spent);
      return {
        ...t,
        remaining: t.budget - t.spent,
        status,
        statusClass: status === 'Over Budget' ? 'over-limit' : status === 'Near Limit' ? 'near-limit' : 'normal'
      };
    });
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
    if (format === 'csv') {
      this.exportAsCsv();
    } else {
      this.exportAsPdf();
    }
    this.closeExportMenu();
  }

  private exportAsCsv(): void {
    const lines: string[] = [];
    const csvCell = (value: string | number): string => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csvRow = (values: Array<string | number>): string => values.map(csvCell).join(',');

    lines.push(csvRow(['Budget Summary']));
    lines.push(csvRow(['Total Budget', `EUR ${this.totalBudget}`]));
    lines.push(csvRow(['Total Spent', `EUR ${this.totalSpent}`]));
    lines.push(csvRow(['Remaining Balance', `EUR ${this.remainingBalance}`]));
    lines.push(csvRow(['Budget Usage', `${this.usagePercentage}%`]));
    lines.push('');

    lines.push(csvRow(['Category Breakdown']));
    lines.push(csvRow(['Category', 'Spent', 'Budget', 'Percentage']));
    this.categoryBudgetRows.forEach(c => {
      lines.push(csvRow([c.name, `EUR ${c.spent}`, `EUR ${c.budget}`, `${c.percentage}%`]));
    });
    lines.push('');

    lines.push(csvRow(['Trip List']));
    lines.push(csvRow(['Trip Name', 'Destination', 'Budget', 'Spent', 'Remaining', 'Status']));
    this.tripRows.forEach(t => {
      lines.push(csvRow([t.name, t.destination, `EUR ${t.budget}`, `EUR ${t.spent}`, `EUR ${t.remaining}`, t.status]));
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

  private exportAsPdf(): void {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      return;
    }

    const categoryRowsHtml = this.categoryBudgetRows
      .map(c => `<tr><td>${c.name}</td><td>EUR ${c.spent}</td><td>EUR ${c.budget}</td><td>${c.percentage}%</td></tr>`)
      .join('');

    const tripRowsHtml = this.tripRows
      .map(t => `<tr><td>${t.name}</td><td>${t.destination}</td><td>EUR ${t.budget}</td><td>EUR ${t.spent}</td><td>EUR ${t.remaining}</td><td>${t.status}</td></tr>`)
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
          <p class="summary-line">Total Budget: EUR ${this.totalBudget}</p>
          <p class="summary-line">Total Spent: EUR ${this.totalSpent}</p>
          <p class="summary-line">Remaining Balance: EUR ${this.remainingBalance}</p>
          <p class="summary-line">Budget Usage: ${this.usagePercentage}%</p>

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
}
