package com.sep.activity;

import java.util.List;

public class ActivityImportBatch {
    private final List<ActivityEntity> activities;
    private final boolean hasMore;

    public ActivityImportBatch(List<ActivityEntity> activities, boolean hasMore) {
        this.activities = activities;
        this.hasMore = hasMore;
    }

    public List<ActivityEntity> getActivities() {
        return activities;
    }

    public boolean isHasMore() {
        return hasMore;
    }
}
