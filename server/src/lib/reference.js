// Fixed vocabularies shared by routes (validation) and exposed to the client via GET /api/reference.
// Categories and locations are DATA (tables); the lists below change rarely and need a code change.

export const HELP_TYPES = ['consultation', 'representation', 'document_review', 'document_drafting', 'mediation', 'general_information'];
export const CONSULT_PREFERENCES = ['online', 'in_person', 'either'];
export const CONSULT_MODES = ['online', 'in_person'];
export const FEE_TYPES = ['fixed', 'hourly', 'itemized'];
// Suggested languages for filters and forms. Free text is still accepted by the API (2–40 characters).
export const LANGUAGES = ['Amharic', 'Afaan Oromo', 'Tigrinya', 'Somali', 'Afar', 'Sidama', 'English', 'Arabic', 'French'];
export const CURRENCIES = ['ETB'];
