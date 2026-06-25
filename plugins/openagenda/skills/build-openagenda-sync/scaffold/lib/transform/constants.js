export const EXT_KEY = 'albi';

// Business rule: never aggregate "Maisons de quartier" sub-category events.
export const EXCLUDED_SUBCATEGORIES = ['9d0c194a-d274-49f8-97e1-b93fd0f42274'];


// --- Additional-field mapping (Step 2 correspondence) -------------------------
// OA additional fields sit at the TOP LEVEL of the event payload, keyed by field
// name, with the option's NUMERIC id (radio = single value). Ids come from the
// agenda's event-form schema. Albi has no audience field, so 'type-de-public'
// defaults to "Tout public" (10).
export const ADDITIONAL_FIELD_DEFAULTS = { 'type-de-public': 10 };

// Albi sous-category id -> OA additional fields.
//   type-devenement: 11 atelier-stage, 12 spectacle-concert, 13 salon-foire,
//   14 rencontre-conferencedebat, 15 marche-brocante, 16 cinema-projection,
//   17 exposition-visite, 18 manifestation-sportive, 19 theatre.
//   categories: 1 culture, 2 sports, 3 education, 4 economie-innovation,
//   5 nature-environnement, 6 patrimoine, 7 loisirs.
export const SUBCATEGORY_TO_OA = {
  '9d0c194a-32b6-4d47-bf01-7d705f007dac': { 'type-devenement': 12, categories: 1 }, // Festival Albi Place(s) aux artistes
  '9d0c194a-0513-442c-b783-9dfc90a1dafe': { categories: 7 },                        // Animation
  '9d0c194a-14d1-4bdf-b112-ef3287e92a00': { 'type-devenement': 17, categories: 1 }, // Exposition / visite
  '9d0c194a-1d67-491a-85e6-7f5102d3ebf4': { 'type-devenement': 13, categories: 4 }, // Salon / foire
  '9d0c194a-2b7a-4f81-98d5-e4f98b33a8e6': { 'type-devenement': 19, categories: 1 }, // Théâtre
  '9d0c194a-2460-45a8-b8b0-3762a75fd221': { 'type-devenement': 12, categories: 1 }, // Concert
  '9d0c194a-20da-4599-b15f-29a9477acee1': { 'type-devenement': 12, categories: 1 }, // Spectacle
  '9d0c194a-07e8-4184-9dc3-8b0e6cc825c9': { 'type-devenement': 11, categories: 7 }, // Atelier / stage
  '9d0c194a-27eb-4241-bf98-f93856eb98c4': { 'type-devenement': 18, categories: 2 }, // Manifestation sportive
  '9d0c194a-4f74-47df-98d9-aaa70314749c': { categories: 2 },                        // Sport / Bien-être / relaxation
  '9d0c194a-1a54-4a3a-a3eb-3feb7f5bf6e7': { 'type-devenement': 15, categories: 7 }, // Marché / vide-grenier
  '9d0c194a-122b-4bfc-9a70-6ae9c24246b7': { categories: 1 },                        // Culture et loisirs
  '9d0c194a-3666-4083-8c6a-dc5a593e62e8': { categories: 7 },                        // Nocturnes gourmandes
  '9d0c194a-0fae-4b06-9b3c-4432aae0180c': { 'type-devenement': 14, categories: 1 }, // Conférence / rencontre
  '9d0c194a-3dec-4b93-a2a9-80cbfda1dc80': { 'type-devenement': 12, categories: 1 }, // Urban Festival
  '9d0c194a-4b51-4628-acfc-9f9320c29841': { categories: 2 },                        // Arts martiaux / sport de combat
  '9d0c194a-539f-49ca-8a2f-3a99a12e6017': { 'type-devenement': 12, categories: 1 }, // Chant
  '9d0c194a-0a83-42f8-b89c-c081d85882e0': { 'type-devenement': 16, categories: 1 }, // Cinéma
};

// Public event page on the Ville d'Albi site — used as a registration fallback
// when the source record carries no contact link/email (the slug is the
// deburred, hyphenated title; verified to resolve).
export const SOURCE_PAGE_BASE = 'https://albi.fr/que-faire-a-albi/agenda';
