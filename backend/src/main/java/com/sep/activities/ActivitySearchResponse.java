package com.sep.activities;

import java.util.List;

public class ActivitySearchResponse {
    private final List<ActivityDto> items;
    private final int page;
    private final int size;
    private final boolean hasMore;

    public ActivitySearchResponse(List<ActivityDto> items, int page, int size, boolean hasMore) {
        this.items = items;
        this.page = page;
        this.size = size;
        this.hasMore = hasMore;
    }

    public List<ActivityDto> getItems() {
        return items;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public boolean isHasMore() {
        return hasMore;
    }
}
