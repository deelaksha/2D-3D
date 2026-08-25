from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator

from schemas.component import Component
from schemas.relationship import Relationship


class Scene(BaseModel):
    model_config = ConfigDict(frozen=True)

    scene_id: str
    scene_type: str
    units: str = "meters"
    components: list[Component]
    relationships: list[Relationship] = []

    @model_validator(mode="after")
    def _unique_component_ids(self) -> "Scene":
        ids = [c.id for c in self.components]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            raise ValueError(f"duplicate component ids: {sorted(dupes)}")
        return self

    @model_validator(mode="after")
    def _relationships_reference_real_components(self) -> "Scene":
        ids = {c.id for c in self.components}
        for r in self.relationships:
            if r.subject not in ids:
                raise ValueError(f"relationship subject {r.subject!r} is not a component id")
            if r.object not in ids:
                raise ValueError(f"relationship object {r.object!r} is not a component id")
        return self

    def component(self, component_id: str) -> Component:
        for c in self.components:
            if c.id == component_id:
                return c
        raise KeyError(component_id)
