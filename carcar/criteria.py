"""Resolve legacy single-select and current multi-select criteria consistently."""
from typing import Any


def normalize_criteria(criteria: dict[str, Any]) -> dict[str, Any]:
    result = dict(criteria)
    for single, multi in (("make", "makes"), ("body", "bodies"),
                          ("fuel", "fuels"), ("gearbox", "gearboxes")):
        values = result.get(multi)
        if not isinstance(values, list):
            continue
        values = list(dict.fromkeys(v.strip() for v in values if isinstance(v, str) and v.strip()))
        result.pop(single, None)
        if values:
            result[multi] = values
        else:
            result.pop(multi, None)
        if multi == "makes" and len(values) != 1:
            result.pop("model", None)
    return result
