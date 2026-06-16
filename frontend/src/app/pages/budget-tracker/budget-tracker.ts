import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-budget-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './budget-tracker.html',
  styleUrl: './budget-tracker.css'
})
export class BudgetTracker {
  // Mock data for User Story #1 — Budget Summary
  totalBudget = 5000;
  totalSpent = 3200;

  get remainingBalance(): number {
    return this.totalBudget - this.totalSpent;
  }

  get usagePercentage(): number {
    return Math.round((this.totalSpent / this.totalBudget) * 100);
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

  // Chart drawing constants (viewBox 0 0 600 220)
  private chartWidth = 600;
  private chartHeight = 220;
  private chartPaddingX = 4;
  private chartPaddingY = 24;

  setChartView(view: 'monthly' | 'yearly'): void {
    this.chartView = view;
  }

  get chartData() {
    return this.chartView === 'monthly' ? this.monthlySpending : this.yearlySpending;
  }

  get chartMax(): number {
    const max = Math.max(...this.chartData.map(d => d.amount));
    return Math.ceil((max * 1.15) / 100) * 100;
  }

  get chartPoints() {
    const data = this.chartData;
    const innerWidth = this.chartWidth - this.chartPaddingX * 2;
    const innerHeight = this.chartHeight - this.chartPaddingY * 2;
    const max = this.chartMax;

    return data.map((d, i) => {
      const x = this.chartPaddingX + (i * innerWidth) / (data.length - 1);
      const y = this.chartPaddingY + innerHeight - (d.amount / max) * innerHeight;
      return { x, y, label: d.label, amount: d.amount };
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
    const bottomY = this.chartHeight - this.chartPaddingY;
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
    { name: 'Flights', amount: 1200, color: '#1A56DB' },
    { name: 'Hotels', amount: 900, color: '#0EA5E9' },
    { name: 'Food', amount: 650, color: '#F59E0B' },
    { name: 'Transport', amount: 300, color: '#7C3AED' },
    { name: 'Activities', amount: 150, color: '#EC4899' }
  ];

  private donutRadius = 70;
  private donutCenter = 100;
  donutStrokeWidth = 28;

  get donutCircumference(): number {
    return 2 * Math.PI * this.donutRadius;
  }

  get categoryTotal(): number {
    return this.categories.reduce((sum, c) => sum + c.amount, 0);
  }

  get donutSegments() {
    const circumference = this.donutCircumference;
    let cumulative = 0;

    return this.categories.map(c => {
      const percentage = (c.amount / this.categoryTotal) * 100;
      const dash = (percentage / 100) * circumference;
      const offset = -((cumulative / 100) * circumference);
      cumulative += percentage;

      return {
        ...c,
        percentage: Math.round(percentage),
        dasharray: `${dash} ${circumference - dash}`,
        dashoffset: offset
      };
    });
  }
}
