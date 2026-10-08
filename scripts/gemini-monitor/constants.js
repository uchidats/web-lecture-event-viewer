// Gemini Monitor Constants and Enums
module.exports = {
  // Model settings
  GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',

  // Schedule intervals based on days until event
  SCHEDULE_TIERS: {
    IMMINENT: { maxDays: 90, intervalDays: 1, label: 'daily (<=90d)' },
    NEAR: { maxDays: 180, intervalDays: 3, label: 'every-3-days (91-180d)' },
    MEDIUM: { maxDays: 365, intervalDays: 7, label: 'weekly (181-365d)' },
    DISTANT: { maxDays: Infinity, intervalDays: 30, label: 'monthly (>365d)' }
  },

  // Focus fields by tier
  FOCUS_FIELDS: {
    IMMINENT: ['date', 'endDate', 'venue', 'abstract_deadline', 'registration_deadline', 'official_url'],
    NEAR: ['date', 'endDate', 'venue', 'abstract_deadline', 'registration_deadline', 'official_url'],
    MEDIUM: ['date', 'endDate', 'city', 'venue', 'official_url'],
    DISTANT: ['date', 'endDate', 'city', 'edition', 'official_url']
  },

  // Source quality ranking (1 to 6)
  SOURCE_QUALITY: {
    OFFICIAL_EVENT_PAGE: 'official_event_page',
    SOCIETY_NEXT_ANNOUNCEMENT: 'society_next_announcement',
    RELATED_SOCIETY_OFFICIAL: 'related_society_official',
    PARENT_BODY_OFFICIAL: 'parent_body_official',
    SECRETARIAT_CONVENTION_OFFICIAL: 'secretariat_convention_official',
    THIRD_PARTY_OR_OTHER: 'third_party_or_other'
  },

  // Recommended actions
  RECOMMENDED_ACTIONS: {
    NO_CHANGE: 'no_change',
    SAFE_AUTO_UPDATE: 'safe_auto_update',
    NEEDS_REVIEW: 'needs_review',
    INSUFFICIENT_EVIDENCE: 'insufficient_evidence'
  },

  // Severity levels
  SEVERITY: {
    NONE: 'none',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
  },

  // Thresholds
  THRESHOLDS: {
    MIN_CONFIDENCE_AUTO_UPDATE: 0.95,
    MAX_ADMIN_REVIEW_ITEMS: 5,
    TARGET_ADMIN_REVIEW_ITEMS_TYPICAL: 3
  }
};
