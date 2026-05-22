# Sidebar Navigation Performance

## Changes

- Request lists are bounded.
- Request cards are presentational on list pages.
- Full request actions render on detail pages only.
- Request list query cache is kept warm for sidebar navigation.
- Dashboard uses smaller request limits.

## Manual Measurements

| Navigation | API count | Slowest endpoint | Slowest duration | Perceived response |
| --- | ---: | --- | ---: | --- |
| Dashboard -> Pool |  |  |  |  |
| Pool -> All requests |  |  |  |  |
| All requests -> Assigned |  |  |  |  |
| Assigned -> Created |  |  |  |  |
| Created -> Pool |  |  |  |  |

## Remaining Bottlenecks

List any endpoint still over 500ms.
