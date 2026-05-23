from linkedln_scrapper.domain.models import UserProfile
from linkedln_scrapper.normalization.text import stable_term_key


class NormalizedProfile:
    def __init__(self, profile: UserProfile):
        self.profile = profile
        self.resume_skills = {stable_term_key(skill): skill for skill in profile.resume.skills}
        self.technologies = {stable_term_key(term): term for term in profile.resume.technologies}
        self.preferred_stack = {stable_term_key(term): term for term in profile.preferred_stack}
        self.strong_interests = {stable_term_key(term): term for term in profile.interests.strong}
        self.moderate_interests = {stable_term_key(term): term for term in profile.interests.moderate}
        self.hard_negatives = {
            stable_term_key(term): term for term in profile.negative_preferences.hard_reject
        }
        self.soft_negatives = {
            stable_term_key(term): term for term in profile.negative_preferences.soft_negative
        }
