"""Downsampling helpers for large chart datasets."""

from datetime import date, datetime
from numbers import Number

from collections.abc import Sequence
from typing import Any


def lttb_downsample(x: Sequence[Any], y: Sequence[Any], threshold: int = 5000) -> tuple[list[Any], list[Any]]:
    """Largest-Triangle-Three-Buckets downsampling.

    Algorithm:
    1. Always keep first and last point
    2. Divide remaining data into (threshold - 2) buckets
    3. For each bucket, keep the point with the largest triangle area
       against the previously-selected point and next-bucket average
    """

    if len(x) != len(y):
        raise ValueError("x and y must have the same length")

    if threshold <= 0:
        raise ValueError("threshold must be positive")

    data_length = len(x)
    if data_length == 0:
        return [], []

    if data_length <= threshold:
        return list(x), list(y)

    if threshold == 1:
        return [x[0]], [y[0]]

    if threshold == 2:
        return [x[0], x[-1]], [y[0], y[-1]]

    x_values = list(x)
    y_values = list(y)
    x_numeric = _to_numeric_axis(x_values, allow_non_numeric=True)
    y_numeric = _to_numeric_axis(y_values, allow_non_numeric=False)

    sampled_indices = [0]
    bucket_size = (data_length - 2) / (threshold - 2)
    a = 0

    for i in range(threshold - 2):
        bucket_start = int((i * bucket_size) + 1)
        bucket_end = int(((i + 1) * bucket_size) + 1)
        bucket_end = min(bucket_end, data_length - 1)

        next_bucket_start = int(((i + 1) * bucket_size) + 1)
        next_bucket_end = int(((i + 2) * bucket_size) + 1)
        next_bucket_end = min(next_bucket_end, data_length)

        next_bucket_len = max(1, next_bucket_end - next_bucket_start)
        avg_x = sum(x_numeric[next_bucket_start:next_bucket_end]) / next_bucket_len
        avg_y = sum(y_numeric[next_bucket_start:next_bucket_end]) / next_bucket_len

        ax = x_numeric[a]
        ay = y_numeric[a]

        max_area = -1.0
        selected_index = bucket_start
        for candidate_index in range(bucket_start, max(bucket_start + 1, bucket_end)):
            area = abs(
                (ax - avg_x) * (y_numeric[candidate_index] - ay)
                - (ax - x_numeric[candidate_index]) * (avg_y - ay)
            ) * 0.5
            if area > max_area:
                max_area = area
                selected_index = candidate_index

        sampled_indices.append(selected_index)
        a = selected_index

    sampled_indices.append(data_length - 1)

    sampled_x = [x_values[index] for index in sampled_indices]
    sampled_y = [y_values[index] for index in sampled_indices]
    return sampled_x, sampled_y


def _to_numeric_axis(values: list[Any], *, allow_non_numeric: bool) -> list[float]:
    """Convert an axis to float values for area calculations."""

    numeric_values: list[float] = []
    for index, value in enumerate(values):
        numeric = _to_float(value)
        if numeric is None:
            if allow_non_numeric:
                numeric_values.append(float(index))
                continue
            raise ValueError("y values must be numeric for downsampling")
        numeric_values.append(numeric)

    return numeric_values


def _to_float(value: Any) -> float | None:
    """Best-effort conversion of a value to float."""

    if isinstance(value, bool):
        return float(int(value))
    if isinstance(value, Number):
        return float(value)
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).timestamp()

    try:
        return float(value)
    except (TypeError, ValueError):
        return None
