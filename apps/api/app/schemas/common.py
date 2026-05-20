from typing import Literal

Role = Literal["fe", "be", "lead"]

RequestStatus = Literal[
    "pending",
    "acknowledged",
    "in_progress",
    "done",
    "cancelled",
]

RequestPriority = Literal[
    "low",
    "medium",
    "high",
    "urgent",
]
