import posixpath
import re

from app.core.exceptions import BadRequestError

SAFE_NAME_RE = re.compile(r"^[^/\\\x00<>:\"|?*]+$")


def normalize_path(path: str) -> str:
    if not path:
        return "/"
    if "\x00" in path:
        raise BadRequestError("Path contains null byte")
    if ".." in path.split("/"):
        raise BadRequestError("Path traversal is not allowed")
    if "//" in path:
        raise BadRequestError("Double slash in path")
    normalized = posixpath.normpath(path)
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    if normalized == "/.":
        normalized = "/"
    return normalized


def validate_name(name: str) -> str:
    if not name or not name.strip():
        raise BadRequestError("Name cannot be empty")
    if name == "." or name == "..":
        raise BadRequestError("Name cannot be '.' or '..'")
    if "/" in name or "\\" in name:
        raise BadRequestError("Name cannot contain slashes")
    if not SAFE_NAME_RE.match(name):
        raise BadRequestError("Name contains unsafe characters")
    return name


def child_path(parent_path: str, name: str) -> str:
    parent = normalize_path(parent_path)
    if parent == "/":
        return f"/{name}"
    return f"{parent}/{name}"


def descendant_prefix(path: str) -> str:
    normalized = normalize_path(path)
    if normalized == "/":
        return "/"
    return normalized.rstrip("/") + "/"


def assert_can_move(file: dict, new_parent_path: str) -> None:
    if file.get("is_directory"):
        old_path = normalize_path(file["path"])
        new_parent = normalize_path(new_parent_path)
        if new_parent == old_path or new_parent.startswith(descendant_prefix(old_path)):
            raise BadRequestError("Cannot move a folder inside itself")


def plan_rename_subtree(file: dict, new_name: str) -> dict:
    name = validate_name(new_name)
    parent_path = normalize_path(file["parent_path"])
    old_path = normalize_path(file["path"])
    new_path = child_path(parent_path, name)
    return {
        "name": name,
        "old_path": old_path,
        "new_path": new_path,
        "parent_path": parent_path,
        "descendant_prefix": descendant_prefix(old_path),
    }


def plan_move_subtree(file: dict, new_parent_path: str) -> dict:
    new_parent = normalize_path(new_parent_path)
    assert_can_move(file, new_parent)
    old_path = normalize_path(file["path"])
    new_path = child_path(new_parent, file["name"])
    return {
        "old_path": old_path,
        "new_path": new_path,
        "new_parent_path": new_parent,
        "descendant_prefix": descendant_prefix(old_path),
    }
