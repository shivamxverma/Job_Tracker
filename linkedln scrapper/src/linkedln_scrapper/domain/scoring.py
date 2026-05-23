from pydantic import BaseModel


class ScoreWeights(BaseModel):
    title: float = 25
    skills: float = 25
    interests: float = 20
    seniority: float = 10
    workplace: float = 5
    recency: float = 5
    description_quality: float = 5
    preferred_stack: float = 5
    hard_negative_penalty: float = -60
    soft_negative_penalty: float = -20
    missing_skill_penalty: float = -4
