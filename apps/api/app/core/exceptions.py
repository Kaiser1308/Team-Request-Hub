class DomainError(Exception):
    """Base class for domain-level exceptions."""


class NotFoundError(DomainError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message)


class ConflictError(DomainError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(message)


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message)


class BadRequestError(DomainError):
    def __init__(self, message: str = "Bad request"):
        super().__init__(message)
