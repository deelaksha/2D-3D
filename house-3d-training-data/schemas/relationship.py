from __future__ import annotations

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.taxonomy import RELATIONSHIP_PREDICATES


class Relationship(BaseModel):
    """An explicit assembly relationship between two component ids
    (prompt.txt #24) -- coordinates alone are not enough."""

    model_config = ConfigDict(frozen=True)

    subject: str
    predicate: str
    object: str

    @field_validator("predicate")
    @classmethod
    def _known_predicate(cls, v: str) -> str:
        if v not in RELATIONSHIP_PREDICATES:
            raise ValueError(
                f"unknown relationship predicate {v!r}, expected one of {sorted(RELATIONSHIP_PREDICATES)}"
            )
        return v
