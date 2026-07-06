import { jsPDF } from 'jspdf';

export interface TripSummaryPdfSource {
  tripName(): string;
  tripTypeLabel(): string;
  tripRouteSummary(): string;
  dateRange(): string;
  nights(): number;
  travelerLabel(): string;
  currencySymbol(): string;
  budget(): number;
  flightTotal(): number;
  hotelTotal(): number;
  activitiesTotal(): number;
  totalUsed(): number;
  remaining(): number;
  flightSegments(): TripSummaryPdfData['flights'];
  hotelStays(): TripSummaryPdfData['hotels'];
  activityGroups(): Array<{ city: string; activities: Array<{ name: string; date?: string; time?: string; price: number }> }>;
  activityTotal(activity: { price: number }): number;
  cityOnly(value: string): string;
  formatDisplayDate(value: string): string;
}

interface TripSummaryPdfData {
  tripName: string;
  tripType: string;
  route: string;
  travelDates: string;
  nights: number;
  travelers: string;
  currencySymbol: string;
  budget: {
    totalBudget: number;
    flightsTotal: number;
    hotelsTotal: number;
    activitiesTotal: number;
    totalSpent: number;
    remainingBudget: number;
  };
  flights: Array<{
    label: string;
    airline: string;
    flightNumber: string;
    from: string;
    to: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: string;
    price: number;
  }>;
  hotels: Array<{
    hotelName: string;
    city: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    stars: number | null;
    price: number;
  }>;
  activityGroups: Array<{
    city: string;
    activities: Array<{
      name: string;
      date?: string;
      time?: string;
      price: number;
    }>;
  }>;
}

export async function exportTripSummaryPdf(source: TripSummaryPdfSource): Promise<void> {
  const data = tripSummaryPdfData(source);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  await renderTripSummaryPdf(pdf, data);
  pdf.save(`${safeFileName(data.tripName)}-trip-summary.pdf`);
}

function tripSummaryPdfData(source: TripSummaryPdfSource): TripSummaryPdfData {
  return {
    tripName: source.tripName(),
    tripType: source.tripTypeLabel(),
    route: source.tripRouteSummary(),
    travelDates: source.dateRange(),
    nights: source.nights(),
    travelers: source.travelerLabel(),
    currencySymbol: source.currencySymbol(),
    budget: {
      totalBudget: source.budget(),
      flightsTotal: source.flightTotal(),
      hotelsTotal: source.hotelTotal(),
      activitiesTotal: source.activitiesTotal(),
      totalSpent: source.totalUsed(),
      remainingBudget: source.remaining(),
    },
    flights: source.flightSegments().map((segment) => ({
      ...segment,
      from: source.cityOnly(segment.from),
      to: source.cityOnly(segment.to),
      date: source.formatDisplayDate(segment.date),
    })),
    hotels: source.hotelStays().map((stay) => ({
      ...stay,
      checkIn: source.formatDisplayDate(stay.checkIn),
      checkOut: source.formatDisplayDate(stay.checkOut),
    })),
    activityGroups: source.activityGroups().map((group) => ({
      city: group.city,
      activities: group.activities.map((activity) => ({
        name: activity.name,
        date: activity.date,
        time: activity.time,
        price: source.activityTotal(activity),
      })),
    })),
  };
}

async function renderTripSummaryPdf(pdf: jsPDF, data: TripSummaryPdfData): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const container = document.createElement('div');
  container.innerHTML = tripSummaryHtml(data);
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#f8fafc';
  document.body.appendChild(container);

  try {
    await document.fonts?.ready;
    const pdfElement = container.querySelector('.roamer-pdf') as HTMLElement | null;

    if (!pdfElement) {
      throw new Error('Trip summary PDF template missing.');
    }

    const canvas = await html2canvas(pdfElement, {
      backgroundColor: '#f8fafc',
      logging: false,
      scale: 2,
      useCORS: true,
    });

    addCanvasPagesToPdf(pdf, canvas, pageBreakAvoidRanges(pdfElement, canvas));
  } finally {
    container.remove();
  }
}

function addCanvasPagesToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, avoidRanges: Array<{ top: number; bottom: number }>): void {
  if (!canvas.width || !canvas.height) {
    throw new Error('Trip summary PDF rendered empty.');
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const sliceHeight = pageSliceHeight(sourceY, pageHeightPx, canvas.height, avoidRanges);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('Could not render Trip Summary PDF page.');
    }

    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, renderedHeight);
    sourceY += sliceHeight;
    pageIndex += 1;
  }
}

function pageBreakAvoidRanges(root: HTMLElement, canvas: HTMLCanvasElement): Array<{ top: number; bottom: number }> {
  const rootRect = root.getBoundingClientRect();
  const scaleY = canvas.height / rootRect.height;

  return Array.from(root.querySelectorAll('.avoid-page-break'))
    .map((element) => {
      const rect = element.getBoundingClientRect();

      return {
        top: Math.max(0, Math.floor((rect.top - rootRect.top) * scaleY) - 12),
        bottom: Math.min(canvas.height, Math.ceil((rect.bottom - rootRect.top) * scaleY) + 12),
      };
    })
    .filter((range) => range.bottom > range.top)
    .sort((a, b) => a.top - b.top);
}

function pageSliceHeight(
  sourceY: number,
  pageHeightPx: number,
  canvasHeight: number,
  avoidRanges: Array<{ top: number; bottom: number }>,
): number {
  const remainingHeight = canvasHeight - sourceY;
  const maxSliceHeight = Math.min(pageHeightPx, remainingHeight);
  const plannedBottom = sourceY + maxSliceHeight;
  const minimumSliceHeight = Math.min(220, Math.floor(pageHeightPx * 0.25));
  const blockingRange = avoidRanges
    .filter((range) => range.top < plannedBottom && range.bottom > plannedBottom)
    .reverse()
    .find((range) => range.top - sourceY > minimumSliceHeight);

  if (blockingRange) {
    return Math.max(1, blockingRange.top - sourceY);
  }

  return maxSliceHeight;
}

function tripSummaryHtml(data: TripSummaryPdfData): string {
  const remainingClass = data.budget.remainingBudget < 0 ? 'negative' : 'positive';

  return `
    <style>
      .roamer-pdf {
        box-sizing: border-box;
        width: 794px;
        min-height: 1123px;
        padding: 34px;
        background: #f8fafc;
        color: #1f2937;
        font-family: Inter, "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.42;
      }

      .pdf-header,
      .top-cards,
      .section-title,
      .card-head,
      .detail-table,
      .budget-table,
      .activity-row,
      .pdf-footer {
        width: 100%;
        border-collapse: collapse;
      }

      .pdf-header {
        margin-bottom: 18px;
      }

      .pdf-title {
        margin: 0;
        color: #0f172a;
        font-size: 34px;
        font-weight: 900;
        letter-spacing: -1px;
      }

      .pdf-subtitle {
        margin-top: 2px;
        color: #2563eb;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .travel-art {
        width: 150px;
        height: 92px;
        text-align: right;
        opacity: .72;
      }

      .top-cards {
        margin-bottom: 22px;
      }

      .top-cell {
        width: 50%;
        vertical-align: top;
      }

      .top-cell:first-child {
        padding-right: 9px;
      }

      .top-cell:last-child {
        padding-left: 9px;
      }

      .summary-card,
      .item-card,
      .activity-card,
      .activity-group,
      .activity-total,
      .activity-entry {
        overflow: hidden;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        page-break-inside: avoid;
        break-inside: avoid;
        -webkit-column-break-inside: avoid;
      }

      .card-bar {
        width: 100%;
        border-collapse: collapse;
        padding: 0;
        color: #ffffff;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: .3px;
      }

      .card-bar td {
        padding: 11px 15px;
        vertical-align: middle;
      }

      .card-bar-icon {
        width: 34px;
      }

      .card-icon-white {
        width: 25px;
        height: 25px;
        display: inline-block;
        box-sizing: border-box;
        padding: 4px;
        border-radius: 50%;
        background: #ffffff;
        vertical-align: middle;
      }

      .card-bar.blue { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
      .card-bar.green { background: linear-gradient(135deg, #059669, #047857); }

      .card-body {
        padding: 14px 15px 15px;
      }

      .info-row,
      .budget-row,
      .activity-item {
        width: 100%;
        border-collapse: collapse;
      }

      .info-row td,
      .budget-row td {
        padding: 5px 0;
        vertical-align: top;
      }

      .info-row td {
        padding: 6px 0;
        vertical-align: middle;
      }

      .info-row-icon {
        width: 24px;
      }

      .info-row-icon span {
        display: inline-block;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #dbeafe;
      }

      .info-row-icon svg {
        width: 18px;
        height: 18px;
      }

      .info-row .label {
        width: 36%;
      }

      .info-row .value {
        text-align: right;
      }

      .label {
        width: 42%;
        color: #64748b;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .7px;
        text-transform: uppercase;
      }

      .value {
        color: #111827;
        font-size: 12px;
        font-weight: 800;
        word-break: break-word;
      }

      .price {
        color: #111827;
        font-weight: 900;
        text-align: right;
        white-space: nowrap;
      }

      .remaining-box {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: #ecfdf5;
        color: #065f46;
        font-weight: 900;
      }

      .remaining-box.negative {
        background: #fef2f2;
        color: #b91c1c;
      }

      .remaining-box table {
        width: 100%;
        border-collapse: collapse;
      }

      .section {
        margin-top: 18px;
        page-break-inside: auto;
      }

      .section-title {
        margin-bottom: 6px;
      }

      .section-title td {
        vertical-align: middle;
      }

      .section-icon-cell {
        width: 36px;
      }

      .section-icon {
        width: 31px;
        height: 31px;
        display: inline-block;
        border-radius: 50%;
        box-shadow: 0 6px 12px rgba(15, 23, 42, 0.12);
      }

      .section-icon svg,
      .card-icon-white svg {
        width: 100%;
        height: 100%;
        vertical-align: middle;
      }

      .section-name {
        width: 150px;
        color: #0f172a;
        font-size: 18px;
        font-weight: 900;
      }

      .divider {
        border-top: 3px dotted #93c5fd;
      }

      .divider.purple { border-top-color: #c4b5fd; }
      .divider.green { border-top-color: #86efac; }

      .section-side-icon {
        width: 32px;
        text-align: right;
      }

      .item-card {
        margin-top: 10px;
        padding: 13px 15px;
      }

      .flight-card {
        border-color: #bfdbfe;
        background: #f8fbff;
      }

      .hotel-card {
        border-color: #ddd6fe;
        background: #fbfaff;
      }

      .badge {
        display: inline-block;
        margin-bottom: 6px;
        padding: 4px 8px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .8px;
        text-transform: uppercase;
      }

      .badge.purple {
        background: #ede9fe;
        color: #6d28d9;
      }

      .item-title {
        color: #111827;
        font-size: 15px;
        font-weight: 900;
        word-break: break-word;
      }

      .item-price {
        color: #2563eb;
        font-size: 15px;
        font-weight: 900;
        text-align: right;
        white-space: nowrap;
      }

      .item-price.purple { color: #7c3aed; }
      .item-price.green { color: #059669; }

      .card-head td {
        vertical-align: top;
      }

      .card-title-cell {
        width: 74%;
        padding-right: 14px;
      }

      .detail-table {
        margin-top: 11px;
      }

      .detail-table td {
        width: 25%;
        padding: 7px 8px;
        vertical-align: top;
        border-radius: 10px;
        background: #f8fafc;
      }

      .detail-label {
        color: #64748b;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .6px;
        text-transform: uppercase;
      }

      .detail-value {
        margin-top: 2px;
        color: #111827;
        font-size: 11px;
        font-weight: 800;
        word-break: break-word;
      }

      .city-heading {
        margin: 0 0 7px;
        color: #065f46;
        font-size: 14px;
        font-weight: 900;
      }

      .activity-group {
        margin-top: 12px;
        overflow: visible;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .activity-card {
        margin-top: 7px;
        padding: 6px;
        border-color: #bbf7d0;
        background: #f8fffb;
      }

      .activity-entry {
        margin: 0;
        border: 0;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: none;
      }

      .activity-item td {
        padding: 9px 10px;
        vertical-align: middle;
      }

      .activity-entry + .activity-entry {
        margin-top: 5px;
        border-top: 1px solid #dcfce7;
      }

      .activity-icon-cell {
        width: 28px;
      }

      .activity-mini-icon {
        display: inline-block;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #dcfce7;
      }

      .activity-mini-icon svg {
        width: 22px;
        height: 22px;
      }

      .activity-name {
        width: 42%;
        color: #111827;
        font-weight: 900;
        word-break: break-word;
      }

      .activity-meta {
        width: 17%;
        color: #475569;
        font-size: 11px;
        font-weight: 800;
      }

      .activity-price {
        width: 18%;
        color: #059669;
        font-size: 13px;
        font-weight: 900;
        text-align: right;
        white-space: nowrap;
      }

      .activity-total {
        margin-top: 8px;
        padding: 12px 14px;
        border-radius: 12px;
        background: #ecfdf5;
        color: #065f46;
        font-weight: 900;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .activity-total table {
        width: 100%;
        border-collapse: collapse;
      }

      .empty {
        margin-top: 8px;
        color: #64748b;
        font-weight: 700;
      }

      .pdf-footer {
        margin-top: 26px;
        border: 1px solid #bfdbfe;
        border-radius: 14px;
        background: #eff6ff;
      }

      .pdf-footer td {
        padding: 12px 16px;
        color: #1e40af;
        font-weight: 900;
        text-align: center;
      }

      .footer-icon {
        width: 34px;
        color: #2563eb;
        text-align: center;
      }

      .footer-icon svg {
        width: 24px;
        height: 24px;
        vertical-align: middle;
      }
    </style>

    <div class="roamer-pdf">
      <table class="pdf-header">
        <tr>
          <td>
            <h1 class="pdf-title">Trip Summary</h1>
            <div class="pdf-subtitle">PDF</div>
          </td>
          <td class="travel-art">
            ${travelSvg()}
          </td>
        </tr>
      </table>

      <table class="top-cards">
        <tr>
          <td class="top-cell">
            <div class="summary-card avoid-page-break">
              ${cardBar('General Trip Info', 'blue', infoIcon('#2563eb'))}
              <div class="card-body">
                ${infoRows([
                  ['Trip name', data.tripName],
                  ['Trip type', data.tripType],
                  ['Route', data.route],
                  ['Travel dates', data.travelDates],
                  ['Nights', `${data.nights}`],
                  ['Travelers', data.travelers],
                ])}
              </div>
            </div>
          </td>
          <td class="top-cell">
            <div class="summary-card avoid-page-break">
              ${cardBar('Budget Overview', 'green', walletIcon('#059669'))}
              <div class="card-body">
                ${budgetRows(data)}
                <div class="remaining-box ${remainingClass}">
                  <table>
                    <tr>
                      <td>Remaining Budget</td>
                      <td class="price">${money(data.budget.remainingBudget, data.currencySymbol)}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      ${flightSection(data)}
      ${hotelSection(data)}
      ${activitySection(data)}

      <table class="pdf-footer">
        <tr>
          <td class="footer-icon">${globeIcon('#2563eb')}</td>
          <td>Thank you for choosing Roamer. Have a great trip!</td>
          <td class="footer-icon">${palmIcon('#2563eb')}</td>
        </tr>
      </table>
    </div>
  `;
}

function flightSection(data: TripSummaryPdfData): string {
  return `
    <section class="section">
      ${sectionTitle('Flights', 'blue', airplaneIcon('#ffffff'), compassIcon('#2563eb'))}
      ${data.flights.length ? data.flights.map((segment, index) => `
        <div class="item-card flight-card avoid-page-break">
          <table class="card-head">
            <tr>
              <td class="card-title-cell">
                <span class="badge">${escapeHtml(segment.label || `Segment ${index + 1}`)}</span>
                <div class="item-title">${escapeHtml(routeText(segment.from, segment.to))}</div>
              </td>
              <td class="item-price">${money(segment.price, data.currencySymbol)}</td>
            </tr>
          </table>
          ${detailTable([
            ['Date', segment.date],
            ['Departure', segment.departureTime],
            ['Arrival', segment.arrivalTime],
            ['Airline', segment.airline],
            ['Flight', segment.flightNumber],
            ['Duration', segment.duration],
            ['Stops', segment.stops],
          ])}
        </div>
      `).join('') : '<p class="empty">No flights selected.</p>'}
    </section>
  `;
}

function hotelSection(data: TripSummaryPdfData): string {
  return `
    <section class="section">
      ${sectionTitle('Hotels', 'purple', bedIcon('#ffffff'), hotelIcon('#7c3aed'))}
      ${data.hotels.length ? data.hotels.map((stay) => `
        <div class="item-card hotel-card avoid-page-break">
          <table class="card-head">
            <tr>
              <td class="card-title-cell">
                <span class="badge purple">${escapeHtml(stay.city || 'Hotel')}</span>
                <div class="item-title">${escapeHtml(cleanText(stay.hotelName))}</div>
              </td>
              <td class="item-price purple">${money(stay.price, data.currencySymbol)}</td>
            </tr>
          </table>
          ${detailTable([
            ['Check-in', stay.checkIn],
            ['Check-out', stay.checkOut],
            ['Nights', stay.nights],
            ['Rating', stay.stars ? `${stay.stars} stars` : ''],
          ])}
        </div>
      `).join('') : '<p class="empty">No hotels selected.</p>'}
    </section>
  `;
}

function activitySection(data: TripSummaryPdfData): string {
  return `
    <section class="section">
      ${sectionTitle('Activities', 'green', ticketIcon('#ffffff'), signpostIcon('#059669'))}
      ${data.activityGroups.length ? data.activityGroups.map((group) => `
        <div class="activity-group avoid-page-break">
          <div class="city-heading">${escapeHtml(group.city)}</div>
          <div class="activity-card avoid-page-break">
            ${group.activities.map((activity) => `
              <div class="activity-entry avoid-page-break">
                <table class="activity-item">
                  <tr>
                    <td class="activity-icon-cell"><span class="activity-mini-icon">${ticketIcon('#059669')}</span></td>
                  <td class="activity-name">${escapeHtml(cleanText(activity.name))}</td>
                  <td class="activity-meta">${escapeHtml(cleanText(activity.date || ''))}</td>
                  <td class="activity-meta">${escapeHtml(cleanText(activity.time || ''))}</td>
                  <td class="activity-price">${money(activity.price, data.currencySymbol)}</td>
                  </tr>
                </table>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('') : '<p class="empty">No activities selected.</p>'}
      ${data.activityGroups.length ? `
        <div class="activity-total avoid-page-break">
          <table>
            <tr>
              <td>Total Activities Price</td>
              <td class="price">Total Price: ${money(data.budget.activitiesTotal, data.currencySymbol)}</td>
            </tr>
          </table>
        </div>
      ` : ''}
    </section>
  `;
}

function sectionTitle(title: string, tone: 'blue' | 'purple' | 'green', icon: string, sideIcon: string): string {
  return `
    <table class="section-title">
      <tr>
        <td class="section-icon-cell">${sectionIcon(tone, icon)}</td>
        <td class="section-name">${escapeHtml(title)}</td>
        <td class="divider ${tone === 'purple' ? 'purple' : tone === 'green' ? 'green' : ''}"></td>
        <td class="section-side-icon">${sideIcon}</td>
      </tr>
    </table>
  `;
}

function cardBar(title: string, tone: 'blue' | 'green', icon: string): string {
  return `
    <table class="card-bar ${tone}">
      <tr>
        <td class="card-bar-icon"><span class="card-icon-white">${icon}</span></td>
        <td>${escapeHtml(title)}</td>
      </tr>
    </table>
  `;
}

function sectionIcon(tone: 'blue' | 'purple' | 'green', icon: string): string {
  const color = tone === 'purple' ? '#7c3aed' : tone === 'green' ? '#059669' : '#2563eb';

  return `
    <span class="section-icon" style="background:${color}">
      ${icon}
    </span>
  `;
}

function infoRows(rows: Array<[string, string | number]>): string {
  return rows.map(([label, value]) => `
    <table class="info-row">
      <tr>
        <td class="info-row-icon"><span>${infoRowIcon(label)}</span></td>
        <td class="label">${escapeHtml(label)}</td>
        <td class="value">${escapeHtml(cleanText(value))}</td>
      </tr>
    </table>
  `).join('');
}

function infoRowIcon(label: string): string {
  const key = label.toLowerCase();

  if (key.includes('name')) {
    return documentIcon('#2563eb');
  }

  if (key.includes('type')) {
    return compassIcon('#2563eb');
  }

  if (key.includes('route')) {
    return locationIcon('#2563eb');
  }

  if (key.includes('date')) {
    return calendarIcon('#2563eb');
  }

  if (key.includes('night')) {
    return bedIcon('#2563eb');
  }

  return usersIcon('#2563eb');
}

function budgetRows(data: TripSummaryPdfData): string {
  return [
    ['Total budget', data.budget.totalBudget],
    ['Flights total', data.budget.flightsTotal],
    ['Hotels total', data.budget.hotelsTotal],
    ['Activities total', data.budget.activitiesTotal],
    ['Total spent', data.budget.totalSpent],
  ].map(([label, value]) => `
    <table class="budget-row">
      <tr>
        <td class="label">${escapeHtml(String(label))}</td>
        <td class="price">${money(Number(value), data.currencySymbol)}</td>
      </tr>
    </table>
  `).join('');
}

function detailTable(rows: Array<[string, string | number | null | undefined]>): string {
  const cells = rows
    .filter(([, value]) => cleanText(value))
    .map(([label, value]) => `
      <td>
        <div class="detail-label">${escapeHtml(label)}</div>
        <div class="detail-value">${escapeHtml(cleanText(value))}</div>
      </td>
    `);
  const renderedRows: string[] = [];

  for (let index = 0; index < cells.length; index += 4) {
    renderedRows.push(`<tr>${cells.slice(index, index + 4).join('')}</tr>`);
  }

  return `<table class="detail-table">${renderedRows.join('')}</table>`;
}

function routeText(from: string, to: string): string {
  return `${cleanText(from)} to ${cleanText(to)}`;
}

function money(value: number, currencySymbol: string): string {
  return `${currencySymbol} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;
}

function cleanText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/\s*!’\s*/g, ' to ')
    .replace(/[!’]+/g, '')
    .replace(/\s*[→➜➡]\s*/g, ' to ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeHtml(value: string | number | null | undefined): string {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function travelSvg(): string {
  return `
    <svg width="150" height="92" viewBox="0 0 150 92" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="105" cy="44" r="34" fill="#eff6ff"/>
      <circle cx="105" cy="44" r="25" fill="none" stroke="#bfdbfe" stroke-width="3"/>
      <circle cx="105" cy="44" r="5" fill="#93c5fd"/>
      <path d="M105 12v14M105 62v14M73 44h14M123 44h14" stroke="#bfdbfe" stroke-width="3" stroke-linecap="round"/>
      <path d="M118 31l-8 18-18 8 8-18 18-8z" fill="#dbeafe" stroke="#93c5fd" stroke-width="2" stroke-linejoin="round"/>
      <path d="M103 42l7 7" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function documentIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 4h7l3 3v13H7V4z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M14 4v4h4M9 12h6M9 16h5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

function locationIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 21s7-5.4 7-12a7 7 0 0 0-14 0c0 6.6 7 12 7 12z" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="12" cy="9" r="2.5" fill="none" stroke="${color}" stroke-width="2"/>
    </svg>
  `;
}

function calendarIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M8 3v4M16 3v4M4 10h16" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function usersIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="16" cy="9" r="2.4" fill="none" stroke="${color}" stroke-width="1.8"/>
      <path d="M4 19c.8-3.2 2.8-5 5-5s4.2 1.8 5 5M14 15c2.4.2 4.2 1.6 5 4" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function infoIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M12 10v7" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="7" r="1.4" fill="${color}"/>
    </svg>
  `;
}

function walletIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M16 11h4v4h-4a2 2 0 0 1 0-4z" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M7 5.2l8-2.2 1 2" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function airplaneIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 11.5l17-7-5 15-4-6-5 4 2-5-5-1z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
}

function bedIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 5v14M20 12v7M4 13h16M7 10h5a2 2 0 0 1 2 2v1H4v-1a2 2 0 0 1 2-2h1z" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 10h2a2 2 0 0 1 2 2v1h-6v-1a2 2 0 0 1 2-2z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
}

function ticketIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M10 8v8M14 10h3M14 14h3" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function compassIcon(color: string): string {
  return `
    <svg width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#dbeafe"/>
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" fill="${color}"/>
    </svg>
  `;
}

function hotelIcon(color: string): string {
  return `
    <svg width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="#ede9fe"/>
      <path d="M8 20V9h8v11M9 12h2M13 12h2M9 15h2M13 15h2" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

function signpostIcon(color: string): string {
  return `
    <svg width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#dcfce7"/>
      <path d="M12 6v13M8 8h8l2 2-2 2H8V8zM16 13H8l-2 2 2 2h8v-4z" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  `;
}

function globeIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="2"/>
      <path d="M3.5 12h17M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
}

function palmIcon(color: string): string {
  return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 21c1.5-5 1.5-9 0-13" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 8C9 5 6 5 4 7c3 .2 5 1 8 1zM12 8c3-3 6-3 8-1-3 .2-5 1-8 1zM12 8c-1-3 .5-5 3-5-.8 2.3-1.5 3.6-3 5z" fill="#60a5fa"/>
    </svg>
  `;
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip-summary';
}
