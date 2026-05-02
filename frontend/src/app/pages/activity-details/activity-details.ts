import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ACTIVITIES, Activity } from '../../services/activities';

@Component({
  selector: 'app-activity-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activity-details.html',
  styleUrls: ['./activity-details.css'],
})
export class ActivityDetailsComponent {
  activity: Activity | undefined;
  relatedActivities: Activity[] = [];

  constructor(private route: ActivatedRoute) {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.activity = ACTIVITIES.find((item: Activity) => item.id === id);

    if (this.activity) {
      this.relatedActivities = ACTIVITIES.filter(
        (item: Activity) =>
          item.id !== this.activity!.id &&
          (item.city === this.activity!.city || item.category === this.activity!.category),
      ).slice(0, 3);
    }
  }

  getCategoryClass(category: string): string {
    return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '');
  }
}
