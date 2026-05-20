# BUSINESS_RULES: Team Request Hub

## 1. Product Definition

**Team Request Hub** là internal request workflow tool cho team.

Mục tiêu:

```txt
- Giảm request nhỏ bị trôi qua chat
- Biết ai tạo request
- Biết ai đang giữ request
- Biết trạng thái hiện tại
- Biết kết quả cuối cùng khi hoàn tất
```

Tool này **không thay ClickUp**.

ClickUp vẫn dùng cho:

```txt
- Task chính
- Sprint
- Roadmap
- Epic/User story lớn
- Planning dài hạn
```

Team Request Hub dùng cho:

```txt
- Request nhỏ giữa team
- Handoff nhanh giữa FE/BE/Lead
- Việc cần tracking nhẹ
- Việc cần reply cuối cùng
```

---

## 2. Core Concept

Entity chính của hệ thống là:

```txt
InternalRequest
```

Không dùng:

```txt
Request      # dễ đụng native Fetch Request
ApiRequest   # scope không còn API-specific
Task         # dễ bị hiểu là thay ClickUp
```

---

## 3. User Roles

Hệ thống có 3 role:

```txt
fe
be
lead
```

Intern không có role riêng.

Intern được map vào:

```txt
fe hoặc be
```

### Role Meaning

```txt
fe:
- Thành viên frontend
- Có thể tạo request
- Có thể nhận request
- Có thể self-assign từ pool
- Có thể update request mình đang giữ

be:
- Thành viên backend
- Có thể tạo request
- Có thể nhận request
- Có thể self-assign từ pool
- Có thể update request mình đang giữ

lead:
- Có toàn quyền giám sát
- Xem tất cả request
- Reassign mọi request
- Cancel mọi request
- Override khi cần
```

---

## 4. Request Type Strategy

Request không có type cứng.

Phân loại bằng:

```txt
tags: string[]
```

Lý do:

```txt
- Giữ hệ thống flexible
- Không phải tạo form riêng cho từng loại việc
- Không bị bó vào API request
- Dễ mở rộng theo thực tế team
```

Suggested tags:

```txt
api
frontend
backend
bug
ui
data
database
auth
config
deployment
review
blocked
urgent
other
```

Rule:

```txt
- Tags chỉ để filter/search/grouping
- Tags không quyết định permission
- Tags không quyết định status flow
- Tags không tạo schema riêng
```

---

## 5. InternalRequest Fields

Core fields:

```txt
id
title
description
tags
priority
status
created_by
assigned_to
reference_links
reply
acknowledged_at
started_at
done_at
cancelled_at
created_at
updated_at
```

### Required on create

```txt
title
description
priority
```

### Optional on create

```txt
tags
assigned_to
reference_links
```

### System-generated

```txt
id
status
created_by
created_at
updated_at
acknowledged_at
started_at
done_at
cancelled_at
reply
```

---

## 6. Priority

Supported values:

```txt
low
medium
high
urgent
```

Default:

```txt
medium
```

Priority meaning:

```txt
low:
- Không gấp
- Có thể xử lý sau

medium:
- Bình thường
- Default cho phần lớn request

high:
- Cần ưu tiên trong ngày hoặc sớm

urgent:
- Đang chặn tiến độ hoặc ảnh hưởng demo/release
```

Priority không tự động override permission.

---

## 7. Status

Supported statuses:

```txt
pending
acknowledged
in_progress
done
cancelled
```

### Meaning

```txt
pending:
- Request mới tạo
- Chưa được người nhận xác nhận
- Hoặc vừa bị reassign/reset

acknowledged:
- Người nhận đã thấy và xác nhận sẽ xử lý
- Chưa bắt đầu làm hoặc chưa chuyển sang in_progress

in_progress:
- Người nhận đang xử lý

done:
- Request đã hoàn tất
- Bắt buộc có reply

cancelled:
- Request bị hủy
- Không xử lý tiếp
```

---

## 8. Status Transition Rules

Allowed transitions:

```txt
pending → acknowledged
pending → cancelled

acknowledged → in_progress
acknowledged → cancelled

in_progress → acknowledged
in_progress → done
in_progress → cancelled
```

Special:

```txt
done là final state
cancelled là final state
```

Not allowed:

```txt
done → any
cancelled → any
pending → done directly
acknowledged → done directly
```

Reasoning:

```txt
- Done cần đi qua in_progress để flow rõ ràng
- Nếu muốn làm nhanh vẫn phải acknowledge → in_progress → done
- Tránh mark done thiếu ngữ cảnh
```

---

## 9. Create Request Rules

Ai được tạo request?

```txt
fe
be
lead
```

Khi tạo request:

```txt
- created_by = current_user.id
- status = pending
- assigned_to có thể là user id hoặc null
```

Nếu assigned_to = null:

```txt
Request nằm trong Pool
```

Nếu assigned_to có user:

```txt
Request được assign trực tiếp cho user đó
```

Notification:

```txt
- Nếu có assigned_to: notify assignee
- Nếu assigned_to = null: tạo pool_new notification theo rule sau này
```

Assignment history:

```txt
- Nếu tạo request có assigned_to, ghi assignment_history
- from_user_id = null
- to_user_id = assigned_to
- assigned_by = creator
```

---

## 10. Pool Rules

Pool là danh sách request chưa có người giữ.

Điều kiện:

```txt
assigned_to = null
status = pending
```

Ai thấy pool?

```txt
fe
be
lead
```

Ai được self-assign?

```txt
fe
be
lead
```

Khi self-assign:

```txt
assigned_to = current_user.id
status giữ pending
ghi assignment_history
notify creator
```

Không được self-assign nếu:

```txt
request đã có assigned_to
request status = done
request status = cancelled
```

---

## 11. Assign Rules

Assign có thể xảy ra khi:

```txt
- Tạo request
- Creator chỉnh người nhận
- Assignee reassign
- Lead reassign
- User self-assign từ pool
```

General rule:

```txt
assigned_to có thể là bất kỳ user active nào trong team
```

Không giới hạn FE chỉ assign BE.

Cho phép:

```txt
FE → BE
FE → FE
FE → Lead
BE → FE
BE → BE
BE → Lead
Lead → FE
Lead → BE
Lead → Lead
```

---

## 12. Reassign Rules

Ai được reassign?

```txt
1. Creator được reassign request mình tạo nếu chưa done/cancelled.
2. Current assignee được reassign request đang assigned cho mình.
3. Lead được reassign mọi request.
```

Không được reassign nếu:

```txt
status = done
status = cancelled
```

### Reassign status behavior

Nếu current status là:

```txt
pending
```

Thì sau reassign:

```txt
status vẫn là pending
```

Nếu current status là:

```txt
acknowledged
in_progress
```

Thì sau reassign:

```txt
status reset về pending
acknowledged_at = null
started_at = null
```

Lý do:

```txt
Người nhận mới chưa acknowledge request.
```

### Reassign reason

Reason bắt buộc nếu current status là:

```txt
acknowledged
in_progress
```

Reason optional nếu current status là:

```txt
pending
```

### Reassign history

Mọi reassign phải ghi:

```txt
assignment_history
```

Fields:

```txt
request_id
from_user_id
to_user_id
assigned_by
reason
created_at
```

### Reassign notification

Khi reassign:

```txt
- Notify người nhận mới
- Notify creator
```

Nếu creator chính là người reassign:

```txt
- Có thể không cần notify creator
```

---

## 13. Update Status Rules

Ai được update status?

```txt
- Current assignee
- Lead
```

Creator không được update status nếu creator không phải assignee hoặc lead.

Lý do:

```txt
Người xử lý mới là người biết tiến độ thật.
```

### Status log

Mọi lần đổi status phải ghi:

```txt
request_status_logs
```

Fields:

```txt
request_id
from_status
to_status
changed_by
reason
created_at
```

Reason optional mặc định.

Reason có thể bắt buộc trong một số action như cancel/reassign tùy phase sau.

---

## 14. Acknowledge Rules

Điều kiện:

```txt
status = pending
current_user là assignee hoặc lead
```

Action:

```txt
status = acknowledged
acknowledged_at = now
ghi status log
notify creator
```

Không được acknowledge nếu:

```txt
assigned_to = null
```

Lý do:

```txt
Pool request chưa có người giữ.
```

---

## 15. In Progress Rules

Điều kiện:

```txt
status = acknowledged
current_user là assignee hoặc lead
```

Action:

```txt
status = in_progress
started_at = now
ghi status log
notify creator
```

---

## 16. Done Rules

Điều kiện:

```txt
status = in_progress
current_user là assignee hoặc lead
```

Action:

```txt
status = done
reply = payload.reply
done_at = now
ghi status log
notify creator
```

Reply bắt buộc.

Reply không được rỗng.

Ví dụ reply tốt:

```txt
Đã thêm field avatarUrl vào response GET /users/me. FE có thể pull latest Swagger.
```

Ví dụ reply không tốt:

```txt
Done
```

MVP chỉ validate không rỗng. Quality rule có thể kiểm soát bằng team convention.

---

## 17. Cancel Rules

Ai được cancel?

```txt
- Creator
- Lead
```

Không cho assignee cancel nếu assignee không phải creator/lead.

Lý do:

```txt
Assignee không nên tự hủy yêu cầu của người khác.
Nếu không làm được thì reassign hoặc báo lại.
```

Điều kiện:

```txt
status != done
status != cancelled
```

Action:

```txt
status = cancelled
cancelled_at = now
ghi status log
notify assignee nếu có
```

Reason:

```txt
optional trong MVP
có thể bắt buộc sau
```

---

## 18. Edit Request Rules

Ai được edit request content?

```txt
- Creator
- Lead
```

Chỉ được edit nếu:

```txt
status = pending
status = acknowledged
status = in_progress
```

Không được edit nếu:

```txt
status = done
status = cancelled
```

Editable fields:

```txt
title
description
tags
priority
reference_links
```

Không edit trực tiếp:

```txt
status
created_by
assigned_to
reply
timestamps
```

Assign/reassign/status/done/cancel phải đi qua endpoint/action riêng.

---

## 19. View Rules

Lead:

```txt
Xem tất cả request
```

User thường xem được:

```txt
- Request mình tạo
- Request đang assign cho mình
- Request trong pool
- Request đã done có liên quan đến mình
```

MVP view tabs:

```txt
Assigned to me
Created by me
Pool
Done
All requests  # lead only
```

---

## 20. Notification Rules

Notification là in-app first.

Backend tạo notification records.

FE chỉ hiển thị và lắng nghe realtime.

Notification events:

```txt
assigned
reassigned
status_changed
pool_new
replied
done
cancelled
```

### Who gets notified?

Create with assignee:

```txt
Notify assignee
```

Create to pool:

```txt
Optional MVP: no notification
Later: notify users by role/tag
```

Self-assign:

```txt
Notify creator
```

Reassign:

```txt
Notify new assignee
Notify creator
```

Status changed:

```txt
Notify creator
```

Done:

```txt
Notify creator
```

Cancelled:

```txt
Notify assignee if exists
```

---

## 21. Assignment History Rules

Assignment history records every assignment movement.

Events that create assignment_history:

```txt
- Create request with assigned_to
- Self-assign from pool
- Reassign
```

Fields:

```txt
id
request_id
from_user_id
to_user_id
assigned_by
reason
created_at
```

Rules:

```txt
from_user_id = null when request was unassigned/pool
to_user_id = new assignee
assigned_by = actor who performed assign/reassign/self-assign
```

---

## 22. Status Log Rules

Status logs record every status change.

Events that create request_status_logs:

```txt
- acknowledge
- in_progress
- done
- cancel
- reassign when status resets
```

Fields:

```txt
id
request_id
from_status
to_status
changed_by
reason
created_at
```

Reassign status reset:

```txt
acknowledged → pending
in_progress → pending
```

must be logged.

---

## 23. API Security Rules

FastAPI must:

```txt
- Verify Supabase JWT
- Load current user from DB by token sub
- Never trust role from frontend
- Never trust created_by from frontend
- Never trust status from frontend without transition check
- Never trust assigned_to without validating user exists
```

Frontend must not:

```txt
- Query DB directly
- Store service role key
- Create notifications directly
- Update status directly in DB
- Create assignment history directly
```

---

## 24. Database Responsibility

Supabase PostgreSQL stores:

```txt
users
internal_requests
assignment_history
request_status_logs
notifications
```

Supabase Auth stores:

```txt
auth.users
```

App user profile table stores:

```txt
id
email
name
avatar_url
role
created_at
```

User id should match Supabase Auth user id.

---

## 25. Final MVP Rule Summary

```txt
- Everyone can create requests.
- Everyone can receive requests.
- Everyone can self-assign from pool.
- Request type is tags, not schema.
- Done requires reply.
- Creator can reassign own request.
- Assignee can reassign current assigned request.
- Lead can reassign everything.
- Reassign from pending keeps pending.
- Reassign from acknowledged/in_progress resets to pending and needs reason.
- Cancel only by creator or lead.
- FE only calls FastAPI.
- FastAPI owns all business logic.
```

---

## 26. Out of Scope for MVP

```txt
- Comment thread
- File upload
- Full document/catalog system
- Slack/Discord/Telegram integration
- Complex SLA
- Due dates
- Subtasks
- Approval workflow
- Multi-tenant
- Analytics dashboard
- Public sharing
```

---

## 27. Future Enhancements

Possible later features:

```txt
- Comments
- Due date
- SLA by priority
- Role/tag-based pool notification
- Slack/Discord/Telegram notification
- Request templates
- Saved tags
- Search and filters
- Analytics for lead
- Reopen done request
- Link ClickUp task sync
```
